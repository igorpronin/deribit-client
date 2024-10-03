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
    const id = `s/${subscription}`;
    remove_elements_from_existing_array(context.subscriptions_pending, id);
    if (!context.subscriptions_active.includes(id)) {
      context.subscriptions_active.push(id);
    }
    context.ee.emit('subscribed', id);
    to_console(context, `Subscribed on ${id}`);
  });
}

export function handle_get_account_summaries_message(
  context: DeribitClient,
  msg: RpcAccSummariesMsg,
) {
  context.username = msg.result.username;
  context.acc_type = msg.result.type;
  context.user_id = msg.result.id;
  msg.result.summaries.forEach((summary) => {
    context.account_summaries[summary.currency] = summary;
  });
  context.ee.emit('account_summaries_updated');
  to_console(context, `Received: account summaries`);
}

export function handle_get_instruments_message(context: DeribitClient, msg: RpcGetInstrumentsMsg) {
  const kind = msg.id.split('/')[1] as Kinds;
  const { result } = msg;
  const list = result as Instrument[];
  context.deribit_instruments_list[kind] = list;
  list.forEach((instrument) => {
    context.deribit_instruments_by_name[instrument.instrument_name] = instrument;
  });
  to_console(context, `Received: ${kind} instruments`);
}

export function handle_get_currencies_message(context: DeribitClient, msg: RpcGetCurrenciesMsg) {
  const { result } = msg;
  const list = result as CurrencyData[];
  context.deribit_currencies_list.list = list;
  to_console(context, `Received: currencies`);
}

export function handle_get_positions_message(context: DeribitClient, msg: RpcGetPositionsMsg) {
  const { result } = msg;
  result.forEach((position) => {
    context.positions[position.instrument_name] = position;
    context.ee.emit('position_updated', position.instrument_name);
  });
  to_console(context, `Received: positions`);
}

export function handle_open_order_message(context: DeribitClient, msg: RpcOpenOrderMsg) {
  const id = msg.id.split('/')[1];
  const order_data = context.orders.all[id];

  order_data.is_pending = false;
  context.orders.pending_orders_amount--;
  const order = msg.result.order;
  const trades = msg.result.trades;

  const { order_id, order_state, label, last_update_timestamp } = order;

  order_data.order_rpc_message_results.push(order);
  if (!context.orders.by_ref_id[order_id]) {
    context.orders.by_ref_id[order_id] = order_data;
  }
  // TODO think here a lot, if it is safe or not
  if (!order_data.state) {
    order_data.state = order_state;
  }
  // TODO warning! order_state not updates here if it is not null already!!
  const is_closing_states =
    order_state === 'filled' || order_state === 'rejected' || order_state === 'cancelled';

  // TODO thank here, probably, move it to subscription handling
  if (is_closing_states) {
    order_data.state = order_state;
    order_data.closed_timestamp = last_update_timestamp;
    let total_amount = 0;
    let total_sum = 0;
    let total_fee = 0;
    trades.forEach((trade) => {
      total_amount += trade.amount;
      total_sum += trade.amount * trade.price;
      total_fee += trade.fee;
    });
    order_data.average_price = total_sum / total_amount;
    order_data.traded_amount = total_amount;
    order_data.total_fee = total_fee;
  }
  context.ee.emit('order_updated', label);
  if (order_state === 'filled') {
    context.ee.emit('order_filled', label);
  }
}
