export const PART_CATEGORIES = [
  { value: "airbags", label: "Airbags / Подушки безопасности" },
  { value: "wheels_tires", label: "Wheels & Tires / Колёса и шины" },
  { value: "radiator_cooling", label: "Radiator & Cooling / Радиатор и охлаждение" },
  { value: "engine", label: "Engine / Двигатель" },
  { value: "transmission", label: "Transmission / Трансмиссия" },
  { value: "brakes", label: "Brakes / Тормоза" },
  { value: "suspension", label: "Suspension / Подвеска" },
  { value: "exhaust", label: "Exhaust / Выхлоп" },
  { value: "electrical", label: "Electrical / Электрика" },
  { value: "lighting", label: "Lighting / Освещение" },
  { value: "body_panels", label: "Body Panels / Кузовные детали" },
  { value: "bumpers", label: "Bumpers / Бамперы" },
  { value: "mirrors", label: "Mirrors / Зеркала" },
  { value: "glass", label: "Glass / Стёкла" },
  { value: "interior", label: "Interior / Салон" },
  { value: "seats", label: "Seats / Сиденья" },
  { value: "steering", label: "Steering / Рулевое управление" },
  { value: "fuel_system", label: "Fuel System / Топливная система" },
  { value: "ac_heating", label: "A/C & Heating / Кондиционер и отопление" },
  { value: "electronics_ecu", label: "ECU & Electronics / Электроника и блоки" },
  { value: "sensors", label: "Sensors / Датчики" },
  { value: "other", label: "Other / Прочее" },
] as const;

export const PART_CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "used", label: "Used" },
  { value: "for_parts", label: "For Parts" },
] as const;

export function getCategoryLabel(value: string): string {
  const cat = PART_CATEGORIES.find((c) => c.value === value);
  return cat ? cat.label : value;
}

export function getConditionLabel(value: string): string {
  const cond = PART_CONDITIONS.find((c) => c.value === value);
  return cond ? cond.label : value;
}
