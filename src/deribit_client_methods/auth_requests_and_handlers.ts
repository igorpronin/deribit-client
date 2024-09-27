import { IDs, PublicMethods, RpcAuthMsg } from '../types';
import { custom_request } from '../actions';

export function create_auth(context: any) {
  return () => {
    context.to_console(
      `Initial Deribit authorisation for the client ${context.client_id} processing...`,
    );
    const msg = custom_request(context.client, PublicMethods.Auth, IDs.Auth, {
      grant_type: 'client_credentials',
      client_id: context.client_id,
      client_secret: context.api_key,
    });
    return msg;
  };
}

export function create_re_auth(context: any) {
  return () => {
    context.to_console(
      `Deribit re authorisation for the client ${context.client_id} processing...`,
    );
    const msg = custom_request(context.client, PublicMethods.Auth, IDs.ReAuth, {
      grant_type: 'refresh_token',
      refresh_token: context.auth_data.refresh_token,
    });
    return msg;
  };
}

export function create_handle_auth_message(context: any) {
  return (msg: RpcAuthMsg, is_re_auth: boolean) => {
    let success_msg, err_msg;
    if (!is_re_auth) {
      success_msg = 'Authorized!';
      err_msg = 'Error during auth';
    } else {
      success_msg = 'Authorisation refreshed!';
      err_msg = 'Error during re-auth';
    }
    if (msg.result) {
      context.auth_data.refresh_token = msg.result.refresh_token;
      context.auth_data.access_token = msg.result.access_token;
      context.auth_data.expires_in = msg.result.expires_in;
      context.auth_data.scope.raw = msg.result.scope;
      context.refresh_counter_id = context.count_refresh();
      if (!is_re_auth) {
        context.authorized_at = new Date();
        context.ee.emit('authorized');
      }
      context.auth_data.state = true;
      context.to_console(success_msg);
    }
  };
}
