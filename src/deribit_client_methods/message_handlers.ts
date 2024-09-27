import {
  RpcSubscribedMsg,
  RpcGetInstrumentsMsg,
  Kinds,
  Instrument,
  RpcGetCurrenciesMsg,
  CurrencyData,
  RpcGetPositionsMsg,
  RpcOpenOrderMsg,
} from '../types';
import { remove_elements_from_existing_array } from '@igorpronin/utils';

export function create_handle_subscribed_message(context: any) {
  return (msg: RpcSubscribedMsg) => {
    const { result } = msg;
    result.forEach((subscription) => {
      remove_elements_from_existing_array(context.pending_subscriptions, subscription);
      context.active_subscriptions.push(subscription);
      context.ee.emit('subscribed', subscription);
      context.to_console(`Subscribed on ${subscription}`);
    });
  };
}

export function create_handle_get_instruments_message(context: any) {
  return (msg: RpcGetInstrumentsMsg) => {
    const kind = msg.id.split('/')[1] as Kinds;
    const { result } = msg;
    const list = result as Instrument[];
    context.deribit_instruments_list[kind as keyof typeof context.deribit_instruments_list] = list;
    list.forEach((instrument) => {
      context.deribit_instruments_by_name[instrument.instrument_name] = instrument;
    });
  };
}

export function create_handle_get_currencies_message(context: any) {
  return (msg: RpcGetCurrenciesMsg) => {
    const { result } = msg;
    const list = result as CurrencyData[];
    context.deribit_currencies_list.list = list;
  };
}

export function create_handle_get_positions_message(context: any) {
  return (msg: RpcGetPositionsMsg) => {
    const { result } = msg;
    result.forEach((position) => {
      context.positions[position.instrument_name] = position;
      context.ee.emit('position_updated', position.instrument_name);
    });
  };
}

export function create_handle_open_order_message(context: any) {
  return (msg: RpcOpenOrderMsg) => {
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
  };
}
