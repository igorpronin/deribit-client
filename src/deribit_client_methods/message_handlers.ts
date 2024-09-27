import {
  RpcSubscribedMsg,
  RpcGetInstrumentsMsg,
  Kinds,
  Instrument,
  RpcGetCurrenciesMsg,
  CurrencyData,
  RpcGetPositionsMsg,
  RpcOpenOrderMsg,
  RpcAccSummariesMsg,
} from '../types/types';
import { remove_elements_from_existing_array } from '@igorpronin/utils';
import { DeribitClient } from '../DeribitClient';
import { to_console } from './utils';

export function handle_subscribed_message(context: DeribitClient, msg: RpcSubscribedMsg) {
  const { result } = msg;
  result.forEach((subscription) => {
    remove_elements_from_existing_array(context.pending_subscriptions, subscription);
    context.active_subscriptions.push(subscription);
    context.ee.emit('subscribed', subscription);
    to_console(context, `Subscribed on ${subscription}`);
  });
}

export function handle_get_account_summaries_message(
  context: DeribitClient,
  msg: RpcAccSummariesMsg,
) {
  context.username = msg.result.username;
  context.acc_type = msg.result.type;
  context.user_id = msg.result.id;
  to_console(context, `Account summaries received`);
}

export function handle_get_instruments_message(context: DeribitClient, msg: RpcGetInstrumentsMsg) {
  const kind = msg.id.split('/')[1] as Kinds;
  const { result } = msg;
  const list = result as Instrument[];
  context.deribit_instruments_list[kind as keyof typeof context.deribit_instruments_list] = list;
  list.forEach((instrument) => {
    context.deribit_instruments_by_name[instrument.instrument_name] = instrument;
  });
}

export function handle_get_currencies_message(context: DeribitClient, msg: RpcGetCurrenciesMsg) {
  const { result } = msg;
  const list = result as CurrencyData[];
  context.deribit_currencies_list.list = list;
}

export function handle_get_positions_message(context: DeribitClient, msg: RpcGetPositionsMsg) {
  const { result } = msg;
  result.forEach((position) => {
    context.positions[position.instrument_name] = position;
    context.ee.emit('position_updated', position.instrument_name);
  });
}

export function handle_open_order_message(context: DeribitClient, msg: RpcOpenOrderMsg) {
  const id = msg.id.split('/')[1];
  const order_data = context.orders.all[id];
  order_data.is_pending = false;
  context.orders.pending_orders_amount--;
  const order = msg.result.order;
  const { order_id, order_state } = order;
  order_data.order_rpc_message_results.push(order);
  if (!context.orders.by_ref_id[order_id]) {
    context.orders.by_ref_id[order_id] = order_data;
  }
  if (!order_data.state) {
    order_data.state = order_state;
  }
  const is_closing_states =
    order_state === 'filled' || order_state === 'rejected' || order_state === 'cancelled';
  if (order_data.state === 'open' && is_closing_states) {
    order_data.state = order_state;
  }
}
