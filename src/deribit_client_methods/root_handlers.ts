import {
  RpcErrorResponse,
  RpcSuccessResponse,
  IDs,
  RpcAuthMsg,
  RpcSubscribedMsg,
  RpcOpenOrderMsg,
  RpcAccSummariesMsg,
  BTCIndexData,
  RpcGetCurrenciesMsg,
  RpcSubscriptionMessage,
  RpcGetPositionsMsg,
  Currencies,
  RpcGetInstrumentsMsg,
} from '../types/types';
import { Indexes, TickerData } from '../types/deribit_objects';
import { calculate_future_apr_and_premium, calculate_premium } from '../helpers';
import { DeribitClient } from '../DeribitClient';
import {
  process_request_obligatory_data,
  process_subscribe_requested_indexes,
  process_subscribe_requested_instruments,
} from './actions';
import { handle_auth_message } from './auth_requests_and_handlers';
import {
  handle_subscribed_message,
  handle_get_account_summaries_message,
  handle_get_instruments_message,
  handle_get_currencies_message,
  handle_get_positions_message,
  handle_open_order_message,
} from './message_handlers';
import {
  to_console,
  init_pending_subscriptions_check,
  hadle_opligatory_data_status,
  is_instruments_list_ready,
} from './utils';

export function handle_rpc_error_response(context: DeribitClient, msg: RpcErrorResponse) {
  const { code, message } = msg.error;
  const m = `RPC error, message: ${message}, code: ${code}`;
  to_console(context, m, msg.error);

  // 13004 "invalid_credentials"
  if (code === 13004) {
    throw new Error(m);
  }
}

export function handle_rpc_success_response(context: DeribitClient, msg: RpcSuccessResponse) {
  const { id } = msg;

  if (id === IDs.Auth) {
    handle_auth_message(context, msg as RpcAuthMsg, false);
    process_request_obligatory_data(context);
    process_subscribe_requested_indexes(context);
    init_pending_subscriptions_check(context);
    return;
  }

  if (id === IDs.ReAuth) {
    handle_auth_message(context, msg as RpcAuthMsg, true);
    return;
  }

  if (id.startsWith('s/')) {
    handle_subscribed_message(context, msg as RpcSubscribedMsg);
    if (context.subscriptions_pending.length === 0) {
      context.ee.emit('subscribed_all');
    }
    // validate_if_instance_is_ready(context);
    return;
  }

  if (id.startsWith('o/')) {
    handle_open_order_message(context, msg as RpcOpenOrderMsg);
    return;
  }

  if (id === IDs.AccSummaries) {
    hadle_opligatory_data_status(context, id);
    handle_get_account_summaries_message(context, msg as RpcAccSummariesMsg);
    return;
  }

  if (id === IDs.GetCurrencies) {
    hadle_opligatory_data_status(context, id);
    handle_get_currencies_message(context, msg as RpcGetCurrenciesMsg);
    // validate_if_instance_is_ready(context);
    return;
  }

  if (id === IDs.GetPositions) {
    hadle_opligatory_data_status(context, id);
    handle_get_positions_message(context, msg as RpcGetPositionsMsg);
    // validate_if_instance_is_ready(context);
    return;
  }

  if (id.startsWith('get_instruments/')) {
    hadle_opligatory_data_status(context, id);
    handle_get_instruments_message(context, msg as RpcGetInstrumentsMsg);
    // validate_if_instance_is_ready(context);
    if (is_instruments_list_ready(context)) {
      process_subscribe_requested_instruments(context);
    }
    return;
  }
}

export function handle_rpc_subscription_message(
  context: DeribitClient,
  msg: RpcSubscriptionMessage,
) {
  const { channel, data } = msg.params;
  if (channel.startsWith('user.portfolio')) {
    const currency = channel.split('.')[2].toUpperCase() as Currencies;
    context.ee.emit('portfolio_updated', currency);
    return;
  }
  if (channel.startsWith('deribit_price_index')) {
    const pair = channel.split('.')[1] as Indexes;
    const { price } = data as BTCIndexData;
    context.indexes_list[pair] = price;
    context.ee.emit('index_updated', pair);
    return;
  }
  if (channel.startsWith('ticker')) {
    const instrument_name = channel.split('.')[1];
    if (!context.ticker_data[instrument_name]) {
      context.ticker_data[instrument_name] = {
        raw: data as unknown as TickerData,
        calculated: {
          time_to_expiration_in_minutes: null,
          apr: null,
          premium_absolute: null,
          premium_relative: null,
        },
      };
    }

    const raw_data = data as unknown as TickerData;
    context.ticker_data[instrument_name].raw = raw_data;

    if (raw_data.funding_8h === undefined) {
      context.ticker_data[instrument_name].calculated = calculate_future_apr_and_premium({
        index_price: context.ticker_data[instrument_name].raw.index_price,
        mark_price: context.ticker_data[instrument_name].raw.mark_price,
        timestamp: context.ticker_data[instrument_name].raw.timestamp,
        expiration_timestamp:
          context.deribit_instruments_by_name[instrument_name].expiration_timestamp,
      });
    }
    if (
      raw_data.funding_8h !== undefined &&
      context.ticker_data[instrument_name].raw.index_price !== undefined &&
      context.ticker_data[instrument_name].raw.mark_price !== undefined
    ) {
      context.ticker_data[instrument_name].calculated = calculate_premium(
        context.ticker_data[instrument_name].raw.index_price,
        context.ticker_data[instrument_name].raw.mark_price,
      );
    }

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
}
