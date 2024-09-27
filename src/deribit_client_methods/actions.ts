import {
  custom_request,
  request_get_positions,
  request_get_account_summaries,
  request_open_order,
} from '../rpc_requests';
import { GetInstrumentID, IDs, Kinds, OrderParams } from '../types/types';
import { DeribitClient } from '../DeribitClient';
import { to_console } from './utils';

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
  to_console(context, 'Getting account summaries...');
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
  to_console(context, 'Requesting obligatory initial data...');

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

// Public method, calls from DeribitClient class
export function create_process_open_order(context: DeribitClient) {
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
