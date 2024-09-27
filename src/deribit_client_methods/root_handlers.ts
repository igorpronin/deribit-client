import {
  RpcErrorResponse,
  RpcSuccessResponse,
  IDs,
  RpcAuthMsg,
  RpcSubscribedMsg,
  RpcOpenOrderMsg,
  RpcAccSummariesMsg,
  UserPortfolioByCurrency,
  Indexes,
  BTCIndexData,
  TickerData,
  RpcGetCurrenciesMsg,
  RpcSubscriptionMessage,
  RpcGetPositionsMsg,
  Currencies,
  RpcGetInstrumentsMsg,
  AccountSummary,
  AccSummaryIDs,
} from '../types';
import { calculate_future_apr_and_premium } from '../helpers';
import { is_value_in_enum, remove_elements_from_existing_array } from '@igorpronin/utils';

export function create_handle_rpc_error_response(context: any) {
  return (msg: RpcErrorResponse) => {
    const { code, message } = msg.error;
    const m = `RPC error, message: ${message}, code: ${code}`;
    context.to_console(m, msg.error);
  };
}

export function create_handle_rpc_success_response(context: any) {
  return (msg: RpcSuccessResponse) => {
    const { id, result } = msg;

    if (id === IDs.Auth) {
      context.handle_auth_message(msg as RpcAuthMsg, false);
      context.process_request_obligatory_data();
      context.process_subscribe_on_requested_and_obligatory();
      context.process_get_account_summaries_by_tickers();
      context.process_get_account_summaries();
      context.init_pending_subscriptions_check();
      return;
    }

    if (id === IDs.ReAuth) {
      context.handle_auth_message(msg as RpcAuthMsg, true);
      return;
    }

    if (id.startsWith('s/')) {
      context.handle_subscribed_message(msg as RpcSubscribedMsg);
      if (context.pending_subscriptions.length === 0) {
        context.ee.emit('subscribed_all');
      }
      context.validate_if_instance_is_ready();
      return;
    }

    if (id.startsWith('o/')) {
      context.handle_open_order_message(msg as RpcOpenOrderMsg);
      return;
    }

    if (is_value_in_enum(id, AccSummaryIDs)) {
      const currency = id.split('/')[1] as Currencies;
      context.accounts_summary[currency] = result as AccountSummary;
      context.to_console(`Account summary for the currency ${currency} updated`);
      return;
    }

    if (id === IDs.AccSummaries) {
      const data = msg as RpcAccSummariesMsg;
      context.username = data.result.username;
      context.acc_type = data.result.type;
      context.user_id = data.result.id;
      context.to_console(`Account summaries got`);
      return;
    }

    if (id === IDs.GetCurrencies) {
      remove_elements_from_existing_array(context.obligatory_data_pending, id);
      context.obligatory_data_received.push(id);
      context.handle_get_currencies_message(msg as unknown as RpcGetCurrenciesMsg);
      context.validate_if_instance_is_ready();
      return;
    }

    if (id === IDs.GetPositions) {
      remove_elements_from_existing_array(context.obligatory_data_pending, id);
      context.obligatory_data_received.push(id);
      context.handle_get_positions_message(msg as unknown as RpcGetPositionsMsg);
      context.validate_if_instance_is_ready();
      return;
    }

    if (id.startsWith('get_instruments/')) {
      remove_elements_from_existing_array(context.obligatory_data_pending, id);
      context.obligatory_data_received.push(id);
      context.handle_get_instruments_message(msg as unknown as RpcGetInstrumentsMsg);
      context.validate_if_instance_is_ready();
      return;
    }
  };
}

export function create_handle_rpc_subscription_message(context: any) {
  return (msg: RpcSubscriptionMessage) => {
    const { channel, data } = msg.params;
    if (channel.startsWith('user.portfolio')) {
      const currency = channel.split('.')[2].toUpperCase() as Currencies;
      context.portfolio[currency] = data as UserPortfolioByCurrency;
      context.ee.emit('portfolio_updated', currency);
      return;
    }
    if (channel.startsWith('deribit_price_index')) {
      const pair = channel.split('.')[1] as Indexes;
      const { price } = data as BTCIndexData;
      context.indexes[pair] = price;
      context.ee.emit('index_updated', pair);
      return;
    }
    if (channel.startsWith('ticker')) {
      const instrument_name = channel.split('.')[1];
      if (!context.ticker_data[instrument_name]) {
        context.ticker_data[instrument_name] = {
          raw: data as TickerData,
          calculated: {
            time_to_expiration_in_minutes: null,
            apr: null,
            premium_absolute: null,
            premium_relative: null,
          },
        };
      }
      context.ticker_data[instrument_name].raw = data as TickerData;
      context.ticker_data[instrument_name].calculated = calculate_future_apr_and_premium({
        index_price: context.ticker_data[instrument_name].raw.index_price,
        mark_price: context.ticker_data[instrument_name].raw.mark_price,
        timestamp: context.ticker_data[instrument_name].raw.timestamp,
        expiration_timestamp:
          context.deribit_instruments_by_name[instrument_name].expiration_timestamp,
      });
      context.ee.emit('ticker_updated', instrument_name);
      return;
    }
    if (channel.startsWith('user.changes')) {
      const parts = channel.split('.');
      // console.log(parts);
      // console.log(data);
      // this.portfolio[currency] = data as UserPortfolioByCurrency;
      // this.ee.emit('portfolio_updated', currency);
      return;
    }
  };
}
