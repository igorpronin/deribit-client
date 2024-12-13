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
  Instrument,
  UserChanges,
  UserPortfolioByCurrency,
  BookSubscriptionData,
} from '../types/types';
import { Indexes, TickerData } from '../types/deribit_objects';
import { calculate_future_apr_and_premium, calculate_premium } from '../helpers';
import { DeribitClient } from '../DeribitClient';
import {
  process_request_obligatory_data,
  process_subscribe_requested_indexes,
  process_subscribe_requested_instruments,
  process_request_obligatory_subscriptions,
  process_get_positions,
  process_get_account_summaries,
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

  return false; // Unhandled message
}

export function handle_rpc_success_response(context: DeribitClient, msg: RpcSuccessResponse) {
  const { id } = msg;

  if (id === IDs.Auth) {
    handle_auth_message(context, msg as RpcAuthMsg, false);
    process_request_obligatory_data(context);
    process_request_obligatory_subscriptions(context); // TODO: not implemented yet
    process_subscribe_requested_indexes(context);
    init_pending_subscriptions_check(context);
    return true;
  }

  if (id === IDs.ReAuth) {
    handle_auth_message(context, msg as RpcAuthMsg, true);
    return true;
  }

  if (id.startsWith('s/')) {
    handle_subscribed_message(context, msg as RpcSubscribedMsg);
    if (context.subscriptions_pending.length === 0) {
      context.ee.emit('subscribed_all');
    }
    // validate_if_instance_is_ready(context);
    return true;
  }

  if (id.startsWith('o/')) {
    handle_open_order_message(context, msg as RpcOpenOrderMsg);
    process_get_account_summaries(context);
    process_get_positions(context);
    return true;
  }

  if (id === IDs.AccSummaries) {
    // console.log('AccSummaries');
    // console.log(msg);
    handle_get_account_summaries_message(context, msg as RpcAccSummariesMsg);
    hadle_opligatory_data_status(context, id);
    return true;
  }

  if (id === IDs.GetCurrencies) {
    handle_get_currencies_message(context, msg as RpcGetCurrenciesMsg);
    hadle_opligatory_data_status(context, id);
    // validate_if_instance_is_ready(context);
    return true;
  }

  if (id === IDs.GetPositions) {
    // console.log('GetPositions');
    // console.log(msg);
    handle_get_positions_message(context, msg as RpcGetPositionsMsg);
    hadle_opligatory_data_status(context, id);
    // validate_if_instance_is_ready(context);
    return true;
  }

  if (id.startsWith('get_instruments/')) {
    handle_get_instruments_message(context, msg as RpcGetInstrumentsMsg);
    hadle_opligatory_data_status(context, id);
    // validate_if_instance_is_ready(context);
    if (is_instruments_list_ready(context)) {
      // with orderbook or not
      process_subscribe_requested_instruments(context);
    }
    return true;
  }

  // Unhandled message
  return false;
}

export function handle_rpc_subscription_message(
  context: DeribitClient,
  msg: RpcSubscriptionMessage,
) {
  const { channel, data } = msg.params;
  if (channel.startsWith('user.portfolio')) {
    const subscription_data = data as UserPortfolioByCurrency;
    const currency = channel.split('.')[2].toUpperCase() as Currencies;
    // @ts-expect-error
    if (currency === 'ANY') {
      const data_currency = subscription_data.currency as Currencies;
      context.account_summaries[data_currency] = subscription_data;
      context.ee.emit('portfolio_updated', data_currency);
    } else {
      to_console(context, `Unhandled portfolio subscription: ${channel}`, true);
    }
    return true;
  }

  if (channel.startsWith('deribit_price_index')) {
    const pair = channel.split('.')[1] as Indexes;
    const { price } = data as BTCIndexData;
    context.indexes_list[pair] = price;
    context.ee.emit('index_updated', pair);
    return true;
  }

  if (channel.startsWith('ticker')) {
    const instrument_name = channel.split('.')[1];
    const initial = {
      raw: data as unknown as TickerData,
      calculated: {
        time_to_expiration_in_minutes: null,
        apr: null,
        premium_absolute: null,
        premium_relative: null,
      },
    };
    if (!context.ticker_data[instrument_name]) {
      context.ticker_data[instrument_name] = initial;
    }

    context.ticker_data[instrument_name].raw = data as unknown as TickerData;

    const raw_data = data as unknown as TickerData;
    const instrument = context.deribit_instruments_by_name[instrument_name] as Instrument;

    if (instrument && raw_data.funding_8h === undefined && instrument.expiration_timestamp) {
      context.ticker_data[instrument_name].calculated = calculate_future_apr_and_premium({
        index_price: context.ticker_data[instrument_name].raw.index_price,
        mark_price: context.ticker_data[instrument_name].raw.mark_price,
        timestamp: context.ticker_data[instrument_name].raw.timestamp,
        expiration_timestamp: instrument.expiration_timestamp,
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
    return true;
  }

  if (channel.startsWith('book')) {
    const instrument_name = channel.split('.')[1];
    const initial = {
      instrument_name,
      is_snapshot_received: false,
      bids: [],
      asks: [],
      bids_amount: 0,
      asks_amount: 0,
      mid_price: null,
    };
    if (!context.book_data[instrument_name]) {
      context.book_data[instrument_name] = initial;
    }

    const { bids, asks, type } = data as BookSubscriptionData;

    if (type === 'snapshot') {
      context.book_data[instrument_name].bids = bids.map((bid) => [bid[1], bid[2]]);
      context.book_data[instrument_name].asks = asks.map((ask) => [ask[1], ask[2]]);
      context.book_data[instrument_name].is_snapshot_received = true;
    } else {
      bids.forEach((bid) => {
        const [change_type, price, amount] = bid;
        if (change_type === 'new') {
          context.book_data[instrument_name].bids.push([price, amount]);
          context.book_data[instrument_name].bids.sort((a, b) => b[0] - a[0]);
        }
        if (change_type === 'change') {
          const index = context.book_data[instrument_name].bids.findIndex(
            (bid) => bid[0] === price,
          );
          if (index !== -1) {
            context.book_data[instrument_name].bids[index][1] = amount;
          }
        }
        if (change_type === 'delete') {
          const index = context.book_data[instrument_name].bids.findIndex(
            (bid) => bid[0] === price,
          );
          if (index !== -1) {
            context.book_data[instrument_name].bids.splice(index, 1);
          }
        }
      });

      asks.forEach((ask) => {
        const [change_type, price, amount] = ask;
        if (change_type === 'new') {
          context.book_data[instrument_name].asks.push([price, amount]);
          context.book_data[instrument_name].asks.sort((a, b) => a[0] - b[0]);
        }
        if (change_type === 'change') {
          const index = context.book_data[instrument_name].asks.findIndex(
            (ask) => ask[0] === price,
          );
          if (index !== -1) {
            context.book_data[instrument_name].asks[index][1] = amount;
          }
        }
        if (change_type === 'delete') {
          const index = context.book_data[instrument_name].asks.findIndex(
            (ask) => ask[0] === price,
          );
          if (index !== -1) {
            context.book_data[instrument_name].asks.splice(index, 1);
          }
        }
      });
    }

    if (bids.length > 0) {
      context.book_data[instrument_name].bids_amount = context.book_data[
        instrument_name
      ].bids.reduce((acc, bid) => acc + bid[1], 0);
    }
    if (asks.length > 0) {
      context.book_data[instrument_name].asks_amount = context.book_data[
        instrument_name
      ].asks.reduce((acc, ask) => acc + ask[1], 0);
    }

    if (
      context.book_data[instrument_name].bids.length > 0 &&
      context.book_data[instrument_name].asks.length > 0
    ) {
      context.book_data[instrument_name].mid_price =
        (context.book_data[instrument_name].bids[0][0] +
          context.book_data[instrument_name].asks[0][0]) /
        2;
    }

    // console.log(context.book_data[instrument_name]);

    context.ee.emit('book_updated', instrument_name);
    return true;
  }

  if (channel.startsWith('user.changes')) {
    const changes = data as UserChanges;
    const { trades, positions } = changes;
    context.user_changes.push(changes);
    context.trades.push(...trades);
    trades.forEach((trade) => {
      const { label } = trade;
      if (!label) {
        to_console(
          context,
          `Order's trade has no label, trading from an external source is not recommended`,
          true,
        );
      } else if (!context.orders.all[label]) {
        to_console(
          context,
          `Order with label ${label} not found, the trade proceed from other api client`,
          true,
        );
      } else {
        context.orders.all[label].trades.push(trade);
      }
    });
    positions.forEach((position) => {
      context.positions[position.instrument_name] = position;
      context.ee.emit('position_updated', position.instrument_name);
    });
    // TODO: handle orders (finally)
    return true;
  }

  // Unhandled message
  return false;
}
