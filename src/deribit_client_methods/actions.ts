import {
  custom_request,
  request_subscribe,
  request_get_positions,
  request_get_account_summary,
  request_get_account_summaries,
  request_open_order,
} from '../rpc_requests';
import { Subscriptions, Currencies, GetInstrumentIDs, IDs, OrderParams } from '../types';

// Private
export function create_process_subscribe_on_requested_and_obligatory(context: any) {
  return () => {
    if (!context.auth_data.state) {
      throw new Error('Not authorized');
    }
    context.requested_subscriptions.forEach((subscription: string) => {
      context.to_console(`Subscribing on ${subscription}...`);
      request_subscribe(context.client, subscription as Subscriptions);
      context.pending_subscriptions.push(subscription);
    });
    context.obligatory_subscriptions.forEach((subscription: string) => {
      context.to_console(`Subscribing on ${subscription}...`);
      request_subscribe(context.client, subscription as Subscriptions);
      context.pending_subscriptions.push(subscription);
    });
  };
}

// Private
export function create_process_get_positions(context: any) {
  return () => {
    if (!context.auth_data.state) {
      throw new Error('Not authorized');
    }
    context.to_console(`Requesting positions...`);
    request_get_positions(context.client);
  };
}

// Private
export function create_process_get_account_summaries_by_tickers(context: any) {
  return () => {
    if (!context.auth_data.state) {
      throw new Error('Not authorized');
    }
    context.currencies.forEach((currency: string) => {
      context.to_console(`Getting account summary for currency ${currency}...`);
      request_get_account_summary(context.client, currency as Currencies);
    });
  };
}

// Private
export function create_process_get_account_summaries(context: any) {
  return () => {
    if (!context.auth_data.state) {
      throw new Error('Not authorized');
    }
    context.to_console(`Getting account summaries...`);
    request_get_account_summaries(context.client);
  };
}

// Private
export function create_process_request_obligatory_data(context: any) {
  return () => {
    context.to_console(`Requesting obligatory data...`);

    context.to_console(`Requesting future instruments...`);
    context.obligatory_data_pending.push(GetInstrumentIDs.GetInstrumentFuture);
    custom_request(context.client, 'public/get_instruments', GetInstrumentIDs.GetInstrumentFuture, {
      currency: 'any',
      kind: 'future',
    });

    context.to_console(`Requesting options instruments...`);
    context.obligatory_data_pending.push(GetInstrumentIDs.GetInstrumentOptions);
    custom_request(
      context.client,
      'public/get_instruments',
      GetInstrumentIDs.GetInstrumentOptions,
      {
        currency: 'any',
        kind: 'option',
      },
    );

    context.to_console(`Requesting spot instruments...`);
    context.obligatory_data_pending.push(GetInstrumentIDs.GetInstrumentSpot);
    custom_request(context.client, 'public/get_instruments', GetInstrumentIDs.GetInstrumentSpot, {
      currency: 'any',
      kind: 'spot',
    });

    context.to_console(`Requesting currencies...`);
    context.obligatory_data_pending.push(IDs.GetCurrencies);
    custom_request(context.client, 'public/get_currencies', IDs.GetCurrencies, {});

    context.obligatory_data_pending.push(IDs.GetPositions);
    context.process_get_positions();
  };
}

// public
export function create_process_open_order(context: any) {
  return (params: OrderParams): string => {
    if (!context.auth_data.state) {
      throw new Error('Not authorized');
    }
    if (!context.is_instance_ready) {
      throw new Error('Instance is not ready');
    }
    const { id } = request_open_order(context.client, params);
    context.orders.pending_orders_amount++;
    const order_data = {
      initial: params,
      is_pending: true,
      is_error: false,
      order_rpc_message_results: [],
      state: null,
    };
    context.orders.all[id] = order_data;
    context.orders.list.push(order_data);
    return id;
  };
}
