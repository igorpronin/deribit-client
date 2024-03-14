import WebSocket from 'ws';
import {clearInterval} from 'timers';
import {
  IDs,
  Subscriptions,
  PublicMethods,
  RpcAuthMsg,
  RpcSubscribedMsg,
  RpcMessages,
  PublicSubscriptions,
  PrivateSubscriptions
} from './types';
import {is_value_in_enum, subscribe} from './actions';

type AuthData = {
  state: boolean
  refresh_token: null | string
  access_token: null | string
  expires_in: null | number
  scope: {
    raw: null | string
  }
}

type Params = {
  ws_api_url: string
  api_key: string
  client_id: string
  onopen?: () => void
  onclose?: () => void
  onerror?: () => void
  onmessage: (message: RpcMessages) => void
  subscriptions: Subscriptions[]
}

export class DeribitClient {
  private msg_prefix = '[Deribit client]'
  private refresh_interval = 550 // Refresh authorisation interval in seconds

  private ws_api_url: string;
  private api_key: string;
  private client_id: string;
  private onopen: () => void;
  private onclose: () => void;
  private onmessage: (message: string) => void
  private onerror: () => void

  private refresh_counter: number = 0;
  private refresh_counter_id: any

  private pending_subscriptions: Subscriptions[] = []
  private active_subscriptions: Subscriptions[] = []

  count_refresh = () => {
    return setInterval(() => {
      this.refresh_counter++;
      this.handle_refresh_counter();
    }, 1000);
  }

  handle_refresh_counter = () => {
    if (this.refresh_counter === this.refresh_interval) {
      clearInterval(this.refresh_counter_id);
      this.refresh_counter = 0;
      this.re_auth();
    }
  }

  private to_console = (msg: string) => {
    console.log(`${this.msg_prefix} ${msg}`);
  }

  private auth_data: AuthData = {
    state: false,
    refresh_token: null,
    access_token: null,
    expires_in: null,
    scope: {
      raw: null
    }
  }

  private auth = () => {
    this.to_console(`Initial Deribit authorisation for the client ${this.client_id} processing...`);
    const msg = {
      jsonrpc: '2.0',
      id: IDs.Auth,
      method: PublicMethods.Auth,
      params: {
        grant_type: 'client_credentials',
        client_id: this.client_id,
        client_secret: this.api_key
      }
    };
    this.client.send(JSON.stringify(msg));
  }

  private re_auth = () => {
    this.to_console(`Deribit re authorisation for the client ${this.client_id} processing...`);
    const msg = {
      jsonrpc: '2.0',
      id: IDs.ReAuth,
      method: PublicMethods.Auth,
      params: {
        grant_type: 'refresh_token',
        refresh_token: this.auth_data.refresh_token
      }
    };
    this.client.send(JSON.stringify(msg));
  }

  private handle_auth_message = (msg: RpcAuthMsg, is_re_auth: boolean) => {
    let success_msg, err_msg;
    if (!is_re_auth) {
      success_msg = 'Authorized!';
      err_msg = 'Error during auth';
    } else {
      success_msg = 'Authorisation refreshed!';
      err_msg = 'Error during re-auth';
    }
    if (msg.result) {
      this.to_console(success_msg);
      this.auth_data.refresh_token = msg.result.refresh_token;
      this.auth_data.access_token = msg.result.access_token;
      this.auth_data.expires_in = msg.result.expires_in;
      this.auth_data.scope.raw = msg.result.scope;
      this.refresh_counter_id = this.count_refresh();
    } else {
      const m = err_msg;
      this.to_console(m);
      throw new Error(m);
    }
  }

  private handle_subscribed_message = (msg: RpcSubscribedMsg) => {
    const {result} = msg;
    result.forEach(subscription => {
      this.active_subscriptions.push(subscription);
      this.to_console(`Subscribed on ${subscription}`);
    })
  }

  public get_pending_subscriptions = () => {
    return this.pending_subscriptions;
  }

  public get_active_subscriptions = () => {
    return this.active_subscriptions;
  }

  client: WebSocket;

  constructor(params: Params) {
    const {
      ws_api_url,
      api_key,
      client_id,
      onopen,
      onclose,
      onmessage,
      onerror,
      subscriptions
    } = params;
    this.ws_api_url = ws_api_url;
    this.api_key = api_key;
    this.client_id = client_id;
    this.client = new WebSocket(ws_api_url);

    this.onopen = () => {
      this.auth();
      if (onopen) {
        onopen();
      }
    }
    this.onclose = () => {
      if (onclose) {
        onclose();
      }
    }
    this.onerror = () => {
      if (onerror) {
        onerror();
      }
    };
    this.onmessage = (message) => {
      const parsed: RpcMessages = JSON.parse(message);

      if (parsed.id === IDs.Auth) {
        this.handle_auth_message(parsed as RpcAuthMsg, false);
        subscriptions.forEach(subscription => {
          this.to_console(`Subscribing on ${subscription}...`)
          subscribe(this.client, subscription);
          this.pending_subscriptions.push(subscription);
        })
        return;
      }

      if (parsed.id === IDs.ReAuth) {
        this.handle_auth_message(parsed as RpcAuthMsg, true);
        return;
      }

      if (
        is_value_in_enum(parsed.id, PublicSubscriptions) ||
        is_value_in_enum(parsed.id, PrivateSubscriptions)
      ) {
        this.handle_subscribed_message(parsed as RpcSubscribedMsg);
        return;
      }

      onmessage(parsed as RpcMessages);
    };

    this.client.on('close', this.onclose);
    this.client.on('open', this.onopen);
    this.client.on('message', this.onmessage);
    this.client.on('error', this.onerror);
  }
}
