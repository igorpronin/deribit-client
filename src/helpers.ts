import { ApiEnv } from './types/types';

export const starts_with_prefix = (array: string[], variable: string): boolean => {
  return array.some((prefix) => variable.startsWith(prefix));
};

// The annualized premium of the Future over the Index price,
// for informational purposes (cf. to an interest rate),
// calculated as: %(mid Future price / Index price - 1) * 525600 / min. till expiration.
type Params = {
  index_price: number;
  mark_price: number;
  timestamp: number;
  expiration_timestamp: number;
};

export const calculate_future_apr_and_premium = (params: Params) => {
  const { index_price, mark_price, timestamp, expiration_timestamp } = params;

  const time_to_expiration = expiration_timestamp - timestamp;
  const time_to_expiration_in_minutes = time_to_expiration / (1000 * 60);

  const apr = ((mark_price / index_price - 1) * 525600) / time_to_expiration_in_minutes;
  const { premium_absolute, premium_relative } = calculate_premium(index_price, mark_price);

  return { time_to_expiration_in_minutes, apr, premium_absolute, premium_relative };
};

export const calculate_premium = (index_price: number, mark_price: number) => {
  const premium_absolute = mark_price - index_price;
  const premium_relative = premium_absolute / index_price;

  return { premium_absolute, premium_relative };
};

export const validate_api_env = (api_env: ApiEnv) => {
  const is_valid = api_env === 'prod' || api_env === 'test';
  if (!is_valid) {
    throw new Error('Invalid API environment');
  }
};
