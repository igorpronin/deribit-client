import {
  custom_request,
  request_get_positions,
  request_get_account_summaries,
  request_open_order,
} from '../rpc_requests';
import {
  GetInstrumentID,
  IDs,
  Kinds,
  OrderParams,
  Subscriptions,
  Indexes,
  OrderType,
  TransactionLogCurrencies,
} from '../types/types';
import { DeribitClient } from '../DeribitClient';
import { to_console } from './utils';
import { request_subscribe, request_get_transaction_log } from '../rpc_requests';
import moment from 'moment';
import cron from 'node-cron'; 

export function process_subscribe(context: DeribitClient, subscription: Subscriptions) {
  if (
    context.subscriptions_pending.includes(subscription) ||
    context.subscriptions_active.includes(subscription)
  ) {
    return;
  }
  to_console(context, `Subscribing to s/${subscription}...`);
  const { id } = request_subscribe(context.client, subscription);
  context.subscriptions_pending.push(id);
}

export function process_subscribe_requested_indexes(context: DeribitClient) {
  if (!context.indexes) {
    return;
  }
  context.indexes.forEach((index: Indexes) => {
    process_subscribe(context, `deribit_price_index.${index}`);
  });
}

export function process_subscribe_requested_instruments(context: DeribitClient) {
  if (!context.instruments) {
    return;
  }
  context.instruments.forEach((instrument: string) => {
    if (!context.deribit_instruments_by_name[instrument]) {
      throw new Error(`Instrument ${instrument} not found`);
    }
    process_subscribe(context, `ticker.${instrument}.raw`);
    if (context.instruments_with_orderbook) {
      process_subscribe(context, `book.${instrument}.raw`);
    }
  });
}

export function process_request_obligatory_subscriptions(context: DeribitClient) {
  process_subscribe(context, 'user.changes.any.any.raw');
  process_subscribe(context, 'user.portfolio.any');
}

export function process_get_positions(context: DeribitClient) {
  if (!context.auth_data.state) {
    throw new Error('Not authorized');
  }
  to_console(context, 'Requesting positions...');
  const { id } = request_get_positions(context.client);
  return id;
}

export function process_get_account_summaries(context: DeribitClient) {
  if (!context.auth_data.state) {
    throw new Error('Not authorized');
  }
  to_console(context, 'Requesting account summaries...');
  const { id } = request_get_account_summaries(context.client);
  return id;
}

export function process_get_instruments_list(context: DeribitClient, kind: Kinds): GetInstrumentID {
  to_console(context, `Requesting ${kind} instruments...`);
  let id = `get_instruments/${kind}` as GetInstrumentID;
  custom_request(context.client, 'public/get_instruments', id, {
    currency: 'any',
    kind,
  });
  return id;
}

export function process_get_currencies(context: DeribitClient) {
  to_console(context, 'Requesting currencies...');
  const { id } = custom_request(context.client, 'public/get_currencies', IDs.GetCurrencies, {});
  return id;
}

export function process_request_obligatory_data(context: DeribitClient) {
  to_console(context, 'Processing requests for obligatory initial data...');

  const account_summaries_id = process_get_account_summaries(context);
  context.obligatory_data_pending.push(account_summaries_id);

  const positions_id = process_get_positions(context);
  context.obligatory_data_pending.push(positions_id);

  const currencies_id = process_get_currencies(context);
  context.obligatory_data_pending.push(currencies_id);

  const future_id = process_get_instruments_list(context, 'future');
  context.obligatory_data_pending.push(future_id);

  const options_id = process_get_instruments_list(context, 'option');
  context.obligatory_data_pending.push(options_id);

  const spot_id = process_get_instruments_list(context, 'spot');
  context.obligatory_data_pending.push(spot_id);
}

export function process_request_get_transaction_log(context: DeribitClient, currency: TransactionLogCurrencies, start_timestamp: number) {
  if (!context.auth_data.state) {
    throw new Error('Not authorized');
  }
  const { id } = request_get_transaction_log(context.client, {
    currency,
    start_timestamp,
    end_timestamp: moment().unix() * 1000,
  });
  return id;
}

export function process_transaction_log_on_start(context: DeribitClient) {
  if (context.fetch_transactions_log_from) {
    context.currencies_in_work.forEach((currency) => {
      if (context.fetch_transactions_log_from) {
        process_request_get_transaction_log(context, currency as TransactionLogCurrencies, context.fetch_transactions_log_from);
      }
    });
  }
}

export function process_transaction_log_hourly(context: DeribitClient) {
  if (context.track_transactions_log) {
    cron.schedule('0 * * * *', () => {
      context.currencies_in_work.forEach((currency) => {
        process_request_get_transaction_log(context, currency as TransactionLogCurrencies, moment().subtract(1, 'hour').unix() * 1000);
      });
    });
  }
}

// Public method, calls from DeribitClient class
export function create_process_open_order(context: DeribitClient) {
  return (params: OrderParams): string => {
    if (!context.auth_data.state) {
      throw new Error('Not authorized');
    }
    if (context.readonly) {
      throw new Error('Instance is in readonly mode');
    }
    if (!context.auth_data.trade_permit) {
      throw new Error('Trade "read_write" scope is not granted');
    }
    const { type, price, amount } = params;
    if (type === OrderType.limit && (price === undefined || price <= 0)) {
      throw new Error('Price is required for limit order');
    }
    if (amount === undefined || amount <= 0) {
      throw new Error('Amount is required');
    }
    const { id } = request_open_order(context.client, params);
    context.orders.pending_orders_amount++;
    const order_data = {
      initial: params,
      is_pending: true,
      is_error: false,
      order_rpc_message_results: [],
      state: null,
      trades: [],
      closed_timestamp: null,
      average_price: null,
      traded_amount: null,
      total_fee: null,
    };
    context.orders.all[id] = order_data;
    context.orders.list.push(order_data);
    return id;
  };
}
