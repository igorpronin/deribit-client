import WebSocket from 'ws';

type Params = {
  ws_api_url: string
  api_key: string
  client_id: string
  onopen?: () => void
  onclose?: () => void
  onmessage: (message) => void
  onerror: () => void
}

type Auth = {
  state: boolean
  refresh_token: null | string
  access_token: null | string
  expires_in: null | number
  scope: {
    raw: null | string
  }
}

export class DeribitClient {
  private ws_api_url: string;
  private api_key: string;
  private client_id: string;
  private onopen: () => void;
  private onclose: () => void;
  private onmessage: (message) => void
  private onerror: () => void

  private auth_data: Auth = {
    state: false,
    refresh_token: null,
    access_token: null,
    expires_in: null,
    scope: {
      raw: null
    }
  }

  auth = () => {
    const msg = {
      jsonrpc: '2.0',
      id: 'auth',
      method: 'public/auth',
      params: {
        grant_type: 'client_credentials',
        client_id: this.client_id,
        client_secret: this.api_key
      }
    };
    const m = `Initial Deribit authorisation for the client ${this.client_id}...`;
    console.log(m);
    this.client.send(JSON.stringify(msg));
  }

  re_auth = () => {
    const msg = {
      jsonrpc: '2.0',
      id: 're_auth',
      method: 'public/auth',
      params: {
        grant_type: 'refresh_token',
        refresh_token: this.auth_data.refresh_token
      }
    };
    const m = `Initial Deribit authorisation for the client ${this.client_id}...`;
    console.log(m);
    this.client.send(JSON.stringify(msg));
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
      onerror
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
    this.onmessage = (message) => {
      console.log(message);
      onmessage(message);
    };
    this.onerror = () => {
      onerror();
    };

    this.client.on('close', this.onclose);
    this.client.on('open', this.onopen);
    this.client.on('message', this.onmessage);
    this.client.on('error', this.onerror);
  }
}
