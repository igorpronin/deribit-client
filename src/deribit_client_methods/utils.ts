import { RpcError } from '../types';

export function create_to_console(context: any) {
  return (msg: string, error?: RpcError) => {
    if (error) {
      console.error(error);
    }
    if (!context.output_console) {
      return;
    }
    if (!error) {
      console.log(`${context.msg_prefix} ${msg}`);
    }
  };
}

export function create_count_refresh(context: any): any {
  return () => {
    return setInterval(() => {
      context.refresh_counter++;
      context.handle_refresh_counter();
    }, 1000);
  };
}

export function create_handle_refresh_counter(context: any) {
  return () => {
    if (context.refresh_counter === context.refresh_interval) {
      clearInterval(context.refresh_counter_id);
      context.refresh_counter = 0;
      context.re_auth();
    }
  };
}

export function create_validate_if_instance_is_ready(context: any) {
  return () => {
    const previous_state = context.is_instance_ready;
    context.is_instance_ready =
      context.pending_subscriptions.length === 0 && context.obligatory_data_pending.length === 0;
    const new_state = context.is_instance_ready;
    if (previous_state !== new_state && new_state) {
      context.ee.emit('instance_ready');
    }
  };
}

export function create_init_pending_subscriptions_check(context: any) {
  return () => {
    setTimeout(() => {
      if (context.pending_subscriptions.length) {
        let m = 'WARNING! Pending subscriptions still exist';
        context.pending_subscriptions.forEach((s: string) => {
          m += `\n   ${s}`;
        });
        context.to_console(m);
      }
    }, context.subscriptions_check_time * 1000);
  };
}
