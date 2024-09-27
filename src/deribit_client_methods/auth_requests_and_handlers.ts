import { IDs, PublicMethods, RpcAuthMsg } from '../types/types';
import { custom_request } from '../rpc_requests';
import { DeribitClient } from '../DeribitClient';
import { to_console, count_refresh } from './utils';

export function auth(context: DeribitClient) {
  to_console(
    context,
    `Initial Deribit authorisation for the client ${context.client_id} processing...`,
  );
  const id = IDs.Auth;
  const msg = custom_request(context.client, PublicMethods.Auth, id, {
    grant_type: 'client_credentials',
    client_id: context.client_id,
    client_secret: context.api_key,
  });
  return { id, msg };
}

export function re_auth(context: DeribitClient) {
  to_console(context, `Deribit re authorisation for the client ${context.client_id} processing...`);
  const id = IDs.ReAuth;
  const msg = custom_request(context.client, PublicMethods.Auth, id, {
    grant_type: 'refresh_token',
    refresh_token: context.auth_data.refresh_token,
  });
  return { id, msg };
}

export function handle_auth_message(context: DeribitClient, msg: RpcAuthMsg, is_re_auth: boolean) {
  let success_msg;
  if (!is_re_auth) {
    success_msg = 'Authorized!';
  } else {
    success_msg = 'Authorisation refreshed!';
  }
  context.auth_data.refresh_token = msg.result.refresh_token;
  context.auth_data.access_token = msg.result.access_token;
  context.auth_data.expires_in = msg.result.expires_in;
  context.auth_data.scope.raw = msg.result.scope;
  context.refresh_counter_id = count_refresh(context);
  if (!is_re_auth) {
    context.authorized_at = new Date();
    context.ee.emit('authorized');
  }
  context.auth_data.state = true;
  to_console(context, success_msg);
}
