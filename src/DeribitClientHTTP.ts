import { ApiEnv, Kinds } from './types/types';
import axios from 'axios';
import { validate_api_env } from './helpers';

enum HttpApiUrls {
  prod = 'https://www.deribit.com/api/v2',
  test = 'https://test.deribit.com/api/v2',
}

type Params = {
  api_env: ApiEnv;
}

type InstrumentCurrency = 'BTC' | 'ETH' | 'USDC' | 'USDT' | 'EURR' | 'any';

export class DeribitClientHTTP {
  private readonly baseUrl: HttpApiUrls;

  constructor({ api_env }: Params) {
    validate_api_env(api_env);
    this.baseUrl = api_env === 'prod' ? HttpApiUrls.prod : HttpApiUrls.test;
  }

  async get_instruments(currency: InstrumentCurrency = 'any', kind?: Kinds) {
    let url = `${this.baseUrl}/public/get_instruments?currency=${currency}`;
    if (kind) {
      url += `&kind=${kind}`;
    }
    const response = await axios.get(url);
    return response.data;
  }

  async get_instruments_list(currency: InstrumentCurrency, kind?: Kinds) {
    const response = await this.get_instruments(currency, kind);
    const list = response.result.map((instrument: any) => instrument.instrument_name);
    return list;
  }
}

