'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type Currency = 'MXN' | 'USD'

interface CurrencyContextType {
  currency: Currency
  setCurrency: (currency: Currency) => void
  exchangeRate: number
  setExchangeRate: (rate: number) => Promise<void>
  formatCurrency: (amount: number | string, compact?: boolean) => string
  formatChartTick: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'MXN',
  setCurrency: () => {},
  exchangeRate: 20.0,
  setExchangeRate: async () => {},
  formatCurrency: (amount) => String(amount),
  formatChartTick: (amount) => String(amount),
})

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('MXN')
  const [exchangeRate, setExchangeRateState] = useState<number>(20.0)

  useEffect(() => {
    // Load local storage currency state
    const stored = localStorage.getItem('arthromed-currency') as Currency | null
    if (stored && ['MXN', 'USD'].includes(stored)) {
      setCurrencyState(stored)
    }

    // Load exchange rate from database
    fetch('/api/settings?key=usd_exchange_rate')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.value) {
          const rate = parseFloat(data.value)
          if (!isNaN(rate) && rate > 0) {
            setExchangeRateState(rate)
          }
        }
      })
      .catch((err) => console.error('Error fetching exchange rate setting:', err))
  }, [])

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency)
    localStorage.setItem('arthromed-currency', newCurrency)
  }

  const setExchangeRate = async (rate: number) => {
    setExchangeRateState(rate)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'usd_exchange_rate', value: rate.toString() }),
      })
    } catch (err) {
      console.error('Error saving exchange rate setting:', err)
      throw err;
    }
  }

  const formatCurrency = (amount: number | string, compact = false) => {
    let num = typeof amount === 'number' ? amount : parseFloat(amount) || 0
    if (currency === 'USD') {
      num = num / exchangeRate
    }
    const absNum = Math.abs(num)
    if (compact && absNum >= 1000000) {
      return `${num < 0 ? '-' : ''}$${(absNum / 1000000).toFixed(2)}M`
    }
    
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-MX', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const formatChartTick = (val: number) => {
    let num = val
    if (currency === 'USD') {
      num = val / exchangeRate
    }
    const absVal = Math.abs(num)
    if (absVal >= 1000000) {
      return `${num < 0 ? '-' : ''}$${(absVal / 1000000).toFixed(2)}M`
    }
    return `${num < 0 ? '-' : ''}$${(absVal / 1000).toFixed(0)}k`
  }

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        exchangeRate,
        setExchangeRate,
        formatCurrency,
        formatChartTick,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
