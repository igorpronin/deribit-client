import WebSocket from 'ws';
import { IDs, PrivateMethods, PublicMethods, Subscriptions, OrderParams } from './types/types';
import { generate_random_id } from '@igorpronin/utils';

export const custom_request = (client: WebSocket, method: string, id: string, params: any) => {
  const msg: any = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };
  client.send(JSON.stringify(msg));
  return msg;
};

export const request_subscribe = (
  client: WebSocket,
  subscription: Subscriptions,
): { id: string; msg: any; subscription: Subscriptions } => {
  let method: PublicMethods | PrivateMethods = PublicMethods.PublicSubscribe;
  if (subscription.startsWith('user.portfolio')) {
    method = PrivateMethods.PrivateSubscribe;
  }
  const id = `s/${subscription}`;
  const msg = custom_request(client, method, `s/${subscription}`, {
    channels: [subscription],
  });
  return { id, msg, subscription };
};

// https://docs.deribit.com/#private-get_account_summaries
export const request_get_account_summaries = (client: WebSocket): { id: string; msg: any } => {
  const id = IDs.AccSummaries;
  const msg = custom_request(client, PrivateMethods.AccountSummaries, id, {
    extended: true,
  });
  return { id, msg };
};

// https://docs.deribit.com/#private-get_positions
export const request_get_positions = (client: WebSocket): { id: string; msg: any } => {
  const id = IDs.GetPositions;
  const msg = custom_request(client, PrivateMethods.GetPositions, id, {
    currency: 'any',
  });
  return { id, msg };
};

// https://docs.deribit.com/#private-get_order_state
export const request_get_order_state_by_id = (
  client: WebSocket,
  order_id: string,
): { id: string; msg: any } => {
  const id = IDs.GetOrderState;
  const msg = custom_request(client, PrivateMethods.GetOrderState, id, {
    order_id,
  });
  return { id, msg };
};

// https://docs.deribit.com/#private-buy
// https://docs.deribit.com/#private-sell
export const request_open_order = (
  client: WebSocket,
  { direction, amount, type, price, instrument_name, time_in_force }: OrderParams,
): { id: string; msg: any } => {
  const id = generate_random_id();
  const params = {
    instrument_name,
    amount,
    type,
    label: id,
    price,
    time_in_force,
  };
  const msg = custom_request(client, `private/${direction}`, `o/${id}`, params);
  return { id, msg };
};
