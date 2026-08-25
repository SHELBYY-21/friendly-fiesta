'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const TABLES = ['pending_slips', 'transactions', 'rates', 'pinned_bank_accounts'] as const;

export function useVaultLive(onChange: () => void) {
  const [live, setLive] = useState(false);
  const fn = useRef(onChange);
  fn.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const kick = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.current(), 200);
    };

    let channel = supabase.channel('ct-vault');
    for (const table of TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, kick);
    }
    channel.subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return live;
}
