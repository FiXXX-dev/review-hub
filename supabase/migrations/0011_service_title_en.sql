-- Английские названия услуг (для гостей-туристов).
-- Типовые (из сида отеля) переводятся автоматически, нестандартные
-- владелец заполняет в /admin/services/:slug.

alter table public.services
  add column if not exists title_en text;

update public.services set title_en = 'Room cleaning'     where title_ru = 'Уборка номера'    and title_en is null;
update public.services set title_en = 'Fresh towels'      where title_ru = 'Свежие полотенца' and title_en is null;
update public.services set title_en = 'Drinking water'    where title_ru = 'Питьевая вода'    and title_en is null;
update public.services set title_en = 'Breakfast in room' where title_ru = 'Завтрак в номер'  and title_en is null;
update public.services set title_en = 'Laundry'           where title_ru = 'Прачечная'        and title_en is null;
update public.services set title_en = 'Late check-out'    where title_ru = 'Поздний выезд'    and title_en is null;
update public.services set title_en = 'Something broke'   where title_ru = 'Что-то сломалось' and title_en is null;

-- Английские подписи блоков в пресетах (label_en); страница выбирает
-- подпись по языку гостя, реестр в коде — фолбэк для ручных блоков.
update public.presets p set blocks = (
  select jsonb_agg(
    b || jsonb_build_object('label_en',
      case b ->> 'type'
        when 'rating' then 'Rate us'
        when 'menu' then 'Menu'
        when 'wifi' then 'Wi-Fi'
        when 'instagram' then 'Instagram'
        when 'telegram' then 'Telegram'
        when 'contacts' then 'Contacts'
        when 'price' then 'Prices'
        when 'doctors' then 'Our doctors'
        when 'appointment' then 'Book a visit'
        when 'services' then case when p.key = 'hotel' then 'Room service' else 'Services' end
        when 'service' then 'Room service'
        when 'taxi' then 'Call a taxi'
        when 'info' then case when p.key = 'hotel' then 'About the hotel' else 'Information' end
        when 'catalog' then 'Catalogue'
        when 'masters' then 'Our specialists'
        when 'phone' then 'Call us'
        else b ->> 'label_ru'
      end
    )
  )
  from jsonb_array_elements(p.blocks) as b
);
