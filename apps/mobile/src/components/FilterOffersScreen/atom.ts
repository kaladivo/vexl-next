import {atom} from 'jotai'
import {type OffersFilter} from '../../state/marketplace/domain'
import {
  type Currency,
  type IntendedConnectionLevel,
  type LocationState,
  type Sort,
} from '@vexl-next/domain/dist/general/offers'
import {focusAtom} from 'jotai-optics'
import {
  offersFilterFromStorageAtom,
  offersFilterInitialState,
} from '../../state/offersFilter'

export const sortingAtom = atom<Sort | undefined>(undefined)
export const intendedConnectionLevelAtom = atom<IntendedConnectionLevel>('ALL')

export const offersFilterAtom = atom<OffersFilter>(offersFilterInitialState)

export const setOffersFilterAtom = atom(null, (get, set) => {
  const filter = get(offersFilterFromStorageAtom)
  set(offersFilterAtom, filter)
  set(sortingAtom, filter.sort)
  set(
    intendedConnectionLevelAtom,
    filter.friendLevel?.includes('SECOND_DEGREE') ? 'ALL' : 'FIRST'
  )
})

const isFilterActiveAtom = atom<boolean>(false)

export const filterActiveAtom = atom(
  (get) => get(isFilterActiveAtom),
  (get, set) => {
    const offersFilterFromStorage = get(offersFilterFromStorageAtom)

    set(
      isFilterActiveAtom,
      JSON.stringify(offersFilterFromStorage) !==
        JSON.stringify(offersFilterInitialState)
    )
  }
)

export const currencyAtom = focusAtom(offersFilterAtom, (optic) =>
  optic.prop('currency')
)

export const updateCurrencyLimitsAtom = atom<
  null,
  [
    {
      currency: Currency | undefined
    }
  ],
  boolean
>(null, (get, set, params) => {
  const {currency} = params
  const currencyFromAtom = get(currencyAtom)

  if (currency === currencyFromAtom) {
    set(currencyAtom, undefined)
  } else {
    set(currencyAtom, currency)
    set(amountBottomLimitAtom, get(amountBottomLimitUsdEurCzkAtom))
    set(
      amountTopLimitAtom,
      currency === 'CZK'
        ? get(amountTopLimitCzkAtom)
        : get(amountTopLimitUsdEurAtom)
    )
  }
  return true
})

export const updateLocationStatePaymentMethodAtom = atom<
  null,
  [
    {
      locationState: LocationState
    }
  ],
  boolean
>(null, (get, set, params) => {
  const {locationState} = params
  const locationStateFromAtom = get(locationStateAtom)

  if (locationState === locationStateFromAtom) {
    set(locationStateAtom, undefined)
  } else {
    set(locationStateAtom, locationState)
    set(
      paymentMethodAtom,
      locationState === 'ONLINE' ? ['BANK', 'REVOLUT'] : ['CASH']
    )
    set(locationAtom, [])
  }

  return true
})

export const locationStateAtom = focusAtom(offersFilterAtom, (optic) =>
  optic.prop('locationState')
)

export const locationAtom = focusAtom(offersFilterAtom, (optic) =>
  optic.prop('location')
)

export const btcNetworkAtom = focusAtom(offersFilterAtom, (optic) =>
  optic.prop('btcNetwork')
)

export const paymentMethodAtom = focusAtom(offersFilterAtom, (optic) =>
  optic.prop('paymentMethod')
)

export const amountBottomLimitAtom = focusAtom(offersFilterAtom, (optic) =>
  optic.prop('amountBottomLimit')
)

export const amountTopLimitAtom = focusAtom(offersFilterAtom, (optic) =>
  optic.prop('amountTopLimit')
)

export const amountBottomLimitUsdEurCzkAtom = atom<number>(0)
export const amountTopLimitUsdEurAtom = atom<number>(10000)
export const amountTopLimitCzkAtom = atom<number>(250000)
export const saveFilterActionAtom = atom(null, (get, set) => {
  const offersFilter = get(offersFilterAtom)
  const intendedConnectionLevel = get(intendedConnectionLevelAtom)
  const sorting = get(sortingAtom)
  const newFilterValue: OffersFilter = {
    sort: sorting,
    offerType: offersFilter.offerType,
    currency: offersFilter.currency,
    location: offersFilter.location,
    locationState: offersFilter.locationState,
    paymentMethod: offersFilter.paymentMethod,
    btcNetwork: offersFilter.btcNetwork,
    friendLevel:
      intendedConnectionLevel === 'FIRST'
        ? ['FIRST_DEGREE']
        : ['SECOND_DEGREE'],
    amountBottomLimit: offersFilter.amountBottomLimit,
    amountTopLimit: offersFilter.amountTopLimit,
  }

  set(offersFilterFromStorageAtom, newFilterValue)
  set(
    isFilterActiveAtom,
    JSON.stringify(newFilterValue) !== JSON.stringify(offersFilterInitialState)
  )
})

export const resetFilterAtom = atom(null, (get, set) => {
  set(sortingAtom, undefined)
  set(intendedConnectionLevelAtom, 'ALL')
  set(offersFilterAtom, offersFilterInitialState)
})
