import React from 'react'
import { Smartphone } from 'lucide-react'

// Гость открыл счёт, но стол неизвестен (прямой заход без QR).
// Заказ и счёт отсюда недоступны — нужен скан таблички на столе.
export default function NoTableScreen() {
  return (
    <div className="page center">
      <div className="notfound">
        <div className="notable-icon">
          <Smartphone size={44} strokeWidth={1.6} />
        </div>
        <h1>Приложите телефон к табличке на столе</h1>
        <p>Так мы поймём, за каким столом вы сидите, и покажем ваш счёт.</p>
      </div>
    </div>
  )
}
