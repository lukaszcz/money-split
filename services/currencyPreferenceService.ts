import { supabase } from '@/lib/supabase';
import { CURRENCIES } from '@/utils/currencies';
import * as Localization from 'expo-localization';

const LOCALE_TO_CURRENCY: Record<string, string> = {
  'en-US': 'USD',
  'en-GB': 'GBP',
  'en-CA': 'CAD',
  'en-AU': 'AUD',
  'en-NZ': 'NZD',
  de: 'EUR',
  fr: 'EUR',
  es: 'EUR',
  it: 'EUR',
  nl: 'EUR',
  'pt-BR': 'BRL',
  pt: 'EUR',
  ja: 'JPY',
  'zh-CN': 'CNY',
  'zh-HK': 'HKD',
  'zh-TW': 'TWD',
  ko: 'KRW',
  pl: 'PLN',
  ru: 'RUB',
  tr: 'TRY',
  ar: 'SAR',
  th: 'THB',
  vi: 'VND',
  id: 'IDR',
  ms: 'MYR',
  sv: 'SEK',
  no: 'NOK',
  da: 'DKK',
  fi: 'EUR',
  cs: 'CZK',
  he: 'ILS',
  hi: 'INR',
};

function getLocaleCurrency(): string {
  const locales = Localization.getLocales();

  if (locales && locales.length > 0) {
    const locale = locales[0];
    const languageTag = locale.languageTag;

    if (languageTag && LOCALE_TO_CURRENCY[languageTag]) {
      return LOCALE_TO_CURRENCY[languageTag];
    }

    const languageCode = locale.languageCode;
    if (languageCode && LOCALE_TO_CURRENCY[languageCode]) {
      return LOCALE_TO_CURRENCY[languageCode];
    }

    if (locale.regionCode) {
      const regionKey = `${languageCode}-${locale.regionCode}`;
      if (LOCALE_TO_CURRENCY[regionKey]) {
        return LOCALE_TO_CURRENCY[regionKey];
      }
    }
  }

  return 'USD';
}

export async function getUserCurrencyOrder(): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return CURRENCIES.map((c) => c.code);
  }

  const { data, error } = await supabase
    .from('user_currency_preferences')
    .select('currency_order')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching currency preferences:', error);
    return CURRENCIES.map((c) => c.code);
  }

  if (!data || !data.currency_order || data.currency_order.length === 0) {
    const localeCurrency = getLocaleCurrency();
    const initialOrder = [
      localeCurrency,
      ...CURRENCIES.filter((c) => c.code !== localeCurrency).map((c) => c.code),
    ];

    await saveCurrencyOrder(initialOrder);
    return initialOrder;
  }

  const savedCodes = data.currency_order as string[];
  const allCodes = CURRENCIES.map((c) => c.code);
  const missingCodes = allCodes.filter((code) => !savedCodes.includes(code));

  return [...savedCodes, ...missingCodes];
}

export async function updateCurrencyOrder(
  selectedCurrency: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const currentOrder = await getUserCurrencyOrder();

  const filteredOrder = currentOrder.filter(
    (code) => code !== selectedCurrency,
  );
  const newOrder = [selectedCurrency, ...filteredOrder];

  await saveCurrencyOrder(newOrder);
}

async function saveCurrencyOrder(currencyOrder: string[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { data: existing } = await supabase
    .from('user_currency_preferences')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('user_currency_preferences')
      .update({
        currency_order: currencyOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating currency preferences:', error);
    }
  } else {
    const { error } = await supabase.from('user_currency_preferences').insert({
      user_id: user.id,
      currency_order: currencyOrder,
    });

    if (error) {
      console.error('Error inserting currency preferences:', error);
    }
  }
}

export async function ensureGroupCurrencyInOrder(
  groupCurrency: string,
): Promise<void> {
  const currentOrder = await getUserCurrencyOrder();

  if (currentOrder[0] !== groupCurrency) {
    await updateCurrencyOrder(groupCurrency);
  }
}
