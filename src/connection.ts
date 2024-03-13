import WebSocket from 'ws';

type Params = {
  ws_api_url: string
  onopen: () => void
}

export class DeribitClient {
  private ws_api_url: string;
  private onopen: null | (() => void)

  client: null | WebSocket;

  constructor(params: Params) {
    const {ws_api_url, onopen} = params;
    this.ws_api_url = ws_api_url;
    this.client = new WebSocket(ws_api_url);
    this.onopen = onopen;
    this.client.on('open', onopen);
  }
}
