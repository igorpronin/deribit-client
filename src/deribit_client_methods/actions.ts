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
  EditOrderPriceParams,
} from '../types/types';
import { DeribitClient } from '../DeribitClient';
import {
  to_console,
  validate_auth_and_trade_permit,
  validate_obligatory_subscriptions,
} from './utils';
import {
  request_subscribe,
  request_get_transaction_log,
  request_edit_order,
} from '../rpc_requests';
import moment from 'moment';
import cron from 'node-cron';

const USER_CHANGES_SUBSCRIPTION = 'user.changes.any.any.raw';
const USER_PORTFOLIO_SUBSCRIPTION = 'user.portfolio.any';

export const obligatory_subscriptions = [USER_CHANGES_SUBSCRIPTION, USER_PORTFOLIO_SUBSCRIPTION];

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
  obligatory_subscriptions.forEach((subscription) => {
    process_subscribe(context, subscription as Subscriptions);
  });
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

export function process_request_get_transaction_log(
  context: DeribitClient,
  currency: TransactionLogCurrencies,
  start_timestamp: number,
) {
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
        process_request_get_transaction_log(
          context,
          currency as TransactionLogCurrencies,
          context.fetch_transactions_log_from,
        );
      }
    });
  }
}

export function process_transaction_log_hourly(context: DeribitClient) {
  if (context.track_transactions_log) {
    cron.schedule('0 * * * *', () => {
      context.currencies_in_work.forEach((currency) => {
        process_request_get_transaction_log(
          context,
          currency as TransactionLogCurrencies,
          moment().subtract(1, 'hour').unix() * 1000,
        );
      });
    });
  }
}

// Public method, calls from DeribitClient class
export function create_process_open_order(context: DeribitClient) {
  return (params: OrderParams): string => {
    validate_auth_and_trade_permit(context);
    validate_obligatory_subscriptions(context);
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
      edit_history: [],
      id,
      is_pending: true,
      is_error: false,
      state: null,
      trades: [],
      average_price: null,
      initial_amount: params.amount,
      traded_amount: 0,
      total_fee: 0,
    };
    context.orders.all[id] = order_data;
    context.orders.list.push(order_data);
    to_console(
      context,
      `Order open requested. ID: ${id}, instrument name: ${params.instrument_name}, direction: ${params.direction}, amount: ${params.amount}, type: ${params.type}, price: ${params.price}, time_in_force: ${params.time_in_force}`,
    );
    return id;
  };
}

// Public method, calls from DeribitClient class
export function create_process_edit_order_price(context: DeribitClient) {
  return (params: EditOrderPriceParams) => {
    validate_auth_and_trade_permit(context);
    validate_obligatory_subscriptions(context);
    const { id, price } = params;
    const order_data = context.orders.all[id];
    if (!order_data) {
      throw new Error(`Order ${id} not found`);
    }
    if (order_data.closed_at) {
      to_console(context, `Order ${id} is closed, edit request skipped`, true);
      return id;
    }
    if (price === undefined || price <= 0) {
      throw new Error('Price is required for limit order');
    }
    const ref_id = order_data.ref_id;
    const amount = order_data.initial?.amount;
    if (!ref_id) {
      throw new Error(`Order ${id} with ref_id ${ref_id} not found`);
    }
    if (!amount) {
      throw new Error(`Amount for order with id ${id} is undefined or 0`);
    }
    const edit_params = { id, ref_id, price, amount };
    order_data.edit_history.push(edit_params);
    request_edit_order(context.client, edit_params);
    to_console(context, `Order ${id} edit requested. New price: ${price}`);
    return id;
  };
}
