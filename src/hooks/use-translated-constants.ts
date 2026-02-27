"use client";

import { useTranslations } from 'next-intl';
import { PART_CATEGORIES, PART_CONDITIONS } from '@/lib/constants';

export function useTranslatedCategories() {
  const t = useTranslations('categories');
  return PART_CATEGORIES.map(cat => ({
    value: cat.value,
    label: t(cat.value),
  }));
}

export function useTranslatedConditions() {
  const t = useTranslations('conditions');
  return PART_CONDITIONS.map(cond => ({
    value: cond.value,
    label: t(cond.value),
  }));
}

export function useTranslatedCategoryLabel(value: string): string {
  const t = useTranslations('categories');
  try {
    return t(value);
  } catch {
    return value;
  }
}

export function useTranslatedConditionLabel(value: string): string {
  const t = useTranslations('conditions');
  try {
    return t(value);
  } catch {
    return value;
  }
}
