import {
  atom,
  type Atom,
  getDefaultStore,
  type PrimitiveAtom,
  type SetStateAction,
  type WritableAtom,
} from 'jotai'
import {
  type BtcNetwork,
  type CurrencyCode,
  type Location,
  type LocationState,
  OfferAdminId,
  OfferId,
  type OfferPublicPart,
  type OfferType,
  type OneOfferInState,
  type PaymentMethod,
  type SpokenLanguage,
  SymmetricKey,
} from '@vexl-next/domain/dist/general/offers'
import {molecule} from 'jotai-molecules'

import {IdNumeric} from '@vexl-next/domain/dist/utility/IdNumeric'
import {IsoDatetimeString} from '@vexl-next/domain/dist/utility/IsoDatetimeString.brand'
import {pipe} from 'fp-ts/function'
import * as TE from 'fp-ts/TaskEither'
import * as T from 'fp-ts/Task'
import {Alert} from 'react-native'
import {translationAtom} from '../../../utils/localization/I18nProvider'
import {
  createOfferAtom,
  deleteOffersActionAtom,
  updateOfferAtom,
} from '../../../state/marketplace'
import {toCommonErrorMessage} from '../../../utils/useCommonErrorMessages'
import numberOfFriendsAtom from './numberOfFriendsAtom'
import * as E from 'fp-ts/Either'
import {generateKeyPair} from '@vexl-next/resources-utils/dist/utils/crypto'
import {createInboxAtom} from '../../../state/chat/hooks/useCreateInbox'
import {delayInPipeT} from '../../../utils/fpUtils'
import {generateUuid, Uuid} from '@vexl-next/domain/dist/utility/Uuid.brand'
import {PublicKeyPemBase64} from '@vexl-next/cryptography/dist/KeyHolder'
import {focusAtom} from 'jotai-optics'
import notEmpty from '../../../utils/notEmpty'
import {type OfferEncryptionProgress} from '@vexl-next/resources-utils/dist/offers/OfferEncryptionProgress'
import {currencies} from '../../../utils/localization/currency'
import {sessionDataOrDummyAtom} from '../../../state/session'
import {parsePhoneNumber} from 'awesome-phonenumber'
import showErrorAlert from '../../../utils/showErrorAlert'
import {
  type GetLocationSuggestionsRequest,
  type LocationSuggestion,
} from '@vexl-next/rest-api/dist/services/location/contracts'
import {splitAtom} from 'jotai/utils'
import {fetchLocationSuggestionsAtom} from '../../../state/location/atoms/fetchLocationSuggestionsAtom'
import getValueFromSetStateActionOfAtom from '../../../utils/atomUtils/getValueFromSetStateActionOfAtom'
import getDefaultSpokenLanguage from '../../../utils/localization/getDefaultSpokenLanguage'
import {displayOfferCreationFeedbackAtom} from '../../../state/feedback/atoms'

function getAtomWithNullableValueHandling<T, S>(
  nullableAtom: PrimitiveAtom<T | undefined>,
  atomToSet: PrimitiveAtom<S>,
  propertyToSetInAtom: keyof S
): PrimitiveAtom<T | undefined> {
  return atom(
    (get) => get(nullableAtom),
    (get, set, update: SetStateAction<T | undefined>) => {
      const value = getValueFromSetStateActionOfAtom(update)(() =>
        get(nullableAtom)
      )
      set(nullableAtom, value)
      if (value)
        set(atomToSet, (val) => ({...val, [propertyToSetInAtom]: value}))
    }
  )
}

export function createOfferDummyPublicPart(): OfferPublicPart {
  const userPhoneNumber = getDefaultStore().get(
    sessionDataOrDummyAtom
  ).phoneNumber
  const parsedPhoneNumber = parsePhoneNumber(userPhoneNumber)
  const defaultCurrency = Object.values(currencies).find((currency) =>
    parsedPhoneNumber.countryCode
      ? currency.countryCode.includes(parsedPhoneNumber.countryCode)
      : currencies.USD
  )

  return {
    offerPublicKey: PublicKeyPemBase64.parse('offerPublicKey'),
    location: [],
    offerDescription: '',
    amountBottomLimit: 0,
    amountTopLimit: defaultCurrency?.maxAmount ?? currencies.USD.maxAmount,
    feeState: 'WITHOUT_FEE',
    feeAmount: 0,
    locationState: 'IN_PERSON',
    paymentMethod: ['CASH'],
    btcNetwork: ['ON_CHAIN'],
    currency: defaultCurrency?.code ?? currencies.USD.code,
    offerType: 'SELL',
    spokenLanguages: getDefaultSpokenLanguage(),
    activePriceState: 'NONE',
    activePriceValue: 0,
    activePriceCurrency: defaultCurrency?.code ?? currencies.USD.code,
    active: true,
    groupUuids: [],
  }
}

export interface OfferProgressState {
  currentState: OfferEncryptionProgress['type']
  percentage?: {
    total: number
    current: number
  }
}

export const dummyOffer: OneOfferInState = {
  ownershipInfo: {
    adminId: OfferAdminId.parse('offerAdminId'),
    intendedConnectionLevel: 'ALL',
  },
  flags: {
    reported: false,
  },
  offerInfo: {
    id: IdNumeric.parse(1),
    offerId: OfferId.parse(Uuid.parse(generateUuid())),
    privatePart: {
      commonFriends: ['Mike', 'John'],
      friendLevel: ['FIRST_DEGREE'],
      symmetricKey: SymmetricKey.parse('symmetricKey'),
    },
    publicPart: createOfferDummyPublicPart(),
    createdAt: IsoDatetimeString.parse('1970-01-01T00:00:00.000Z'),
    modifiedAt: IsoDatetimeString.parse('1970-01-01T00:00:00.000Z'),
  },
}

export const offerFormMolecule = molecule(() => {
  const offerAtom = atom<OneOfferInState>(dummyOffer)
  const nullableOfferTypeAtom = atom<OfferType | undefined>(undefined)
  const nullableCurrencyAtom = atom<CurrencyCode | undefined>(
    dummyOffer.offerInfo.publicPart.currency
  )
  const nullableAmountTopLimitAtom = atom<number | undefined>(
    dummyOffer.offerInfo.publicPart.amountTopLimit
  )
  const nullableAmountBottomLimitAtom = atom<number | undefined>(
    dummyOffer.offerInfo.publicPart.amountBottomLimit
  )
  const nullableBtcNetworkAtom = atom<BtcNetwork[] | undefined>(
    dummyOffer.offerInfo.publicPart.btcNetwork
  )
  const nullablePaymentMethodAtom = atom<PaymentMethod[] | undefined>(
    dummyOffer.offerInfo.publicPart.paymentMethod
  )
  const nullableLocationStateAtom = atom<LocationState | undefined>(
    dummyOffer.offerInfo.publicPart.locationState
  )
  const nullableLocationAtom = atom<Location[] | undefined>(
    dummyOffer.offerInfo.publicPart.location
  )

  const showAllFieldsAtom = atom<boolean>(
    (get) => get(nullableOfferTypeAtom) !== undefined
  )

  const offerFormAtom = focusAtom(offerAtom, (optic) =>
    optic.prop('offerInfo').prop('publicPart')
  )

  const currencyAtom = getAtomWithNullableValueHandling(
    nullableCurrencyAtom,
    offerFormAtom,
    'currency'
  )

  const amountBottomLimitAtom = getAtomWithNullableValueHandling(
    nullableAmountBottomLimitAtom,
    offerFormAtom,
    'amountBottomLimit'
  )

  const amountTopLimitAtom = getAtomWithNullableValueHandling(
    nullableAmountTopLimitAtom,
    offerFormAtom,
    'amountTopLimit'
  )

  const updateCurrencyLimitsAtom = atom<
    null,
    [{currency: CurrencyCode | undefined}],
    boolean
  >(null, (get, set, params) => {
    const {currency = 'USD'} = params
    const currencyFromAtom = get(currencyAtom)
    if (currencyFromAtom === currency) return false

    set(currencyAtom, currency)
    set(amountBottomLimitAtom, 0)
    set(amountTopLimitAtom, currencies[currency].maxAmount)
    return true
  })

  const updateLocationStatePaymentMethodAtom = atom<
    null,
    [
      {
        locationState: LocationState
      },
    ],
    boolean
  >(null, (get, set, params) => {
    const {locationState} = params
    set(locationStateAtom, locationState)
    set(
      paymentMethodAtom,
      locationState === 'ONLINE' ? ['BANK', 'REVOLUT'] : ['CASH']
    )
    set(locationAtom, [])
    return true
  })

  const offerTypeAtom = getAtomWithNullableValueHandling(
    nullableOfferTypeAtom,
    offerFormAtom,
    'offerType'
  )

  const offerTypeOrDummyValueAtom = focusAtom(offerFormAtom, (optic) =>
    optic.prop('offerType')
  )

  const spokenLanguagesAtom = focusAtom(offerFormAtom, (optic) =>
    optic.prop('spokenLanguages')
  )

  const spokenLanguagesAtomsAtom = splitAtom(spokenLanguagesAtom)

  const feeAmountAtom = focusAtom(offerFormAtom, (optic) =>
    optic.prop('feeAmount')
  )

  const feeStateAtom = focusAtom(offerFormAtom, (optic) =>
    optic.prop('feeState')
  )

  const locationStateAtom = getAtomWithNullableValueHandling(
    nullableLocationStateAtom,
    offerFormAtom,
    'locationState'
  )

  const locationAtom = getAtomWithNullableValueHandling(
    nullableLocationAtom,
    offerFormAtom,
    'location'
  )

  const btcNetworkAtom = getAtomWithNullableValueHandling(
    nullableBtcNetworkAtom,
    offerFormAtom,
    'btcNetwork'
  )

  const paymentMethodAtom = getAtomWithNullableValueHandling(
    nullablePaymentMethodAtom,
    offerFormAtom,
    'paymentMethod'
  )

  const offerDescriptionAtom = focusAtom(offerFormAtom, (optic) =>
    optic.prop('offerDescription')
  )

  const offerActiveAtom = focusAtom(offerFormAtom, (optic) =>
    optic.prop('active')
  )

  const intendedConnectionLevelAtom = focusAtom(
    offerAtom,
    (optic) =>
      optic
        .optional()
        .prop('ownershipInfo')
        .optional()
        .prop('intendedConnectionLevel') ?? 'FIRST'
  )

  const locationSuggestionsAtom = atom<LocationSuggestion[]>([])

  const locationSuggestionsAtomsAtom = splitAtom(locationSuggestionsAtom)

  const selectedSpokenLanguagesAtom = atom<SpokenLanguage[]>(
    getDefaultSpokenLanguage()
  )

  const removeSpokenLanguageActionAtom = atom(
    null,
    (get, set, spokenLanguage: SpokenLanguage) => {
      const spokenLanguages = get(spokenLanguagesAtom)
      const selectedSpokenLanguages = get(selectedSpokenLanguagesAtom)

      if (selectedSpokenLanguages.length > 1) {
        set(
          spokenLanguagesAtom,
          spokenLanguages.filter((language) => language !== spokenLanguage)
        )
        set(
          selectedSpokenLanguagesAtom,
          selectedSpokenLanguages.filter(
            (language) => language !== spokenLanguage
          )
        )
      }
    }
  )

  function createIsThisLanguageSelectedAtom(
    spokenLanguage: SpokenLanguage
  ): WritableAtom<boolean, [SetStateAction<boolean>], void> {
    return atom(
      (get) => get(selectedSpokenLanguagesAtom).includes(spokenLanguage),
      (get, set, isSelected: SetStateAction<boolean>) => {
        const selectedSpokenLanguages = get(selectedSpokenLanguagesAtom)
        const selected = getValueFromSetStateActionOfAtom(isSelected)(() =>
          get(selectedSpokenLanguagesAtom).includes(spokenLanguage)
        )

        if (selected) {
          set(selectedSpokenLanguagesAtom, [
            ...selectedSpokenLanguages,
            spokenLanguage,
          ])
        } else if (selectedSpokenLanguages.length > 1) {
          set(
            selectedSpokenLanguagesAtom,
            selectedSpokenLanguages.filter((lang) => lang !== spokenLanguage)
          )
        }
      }
    )
  }

  const resetSelectedSpokenLanguagesActionAtom = atom(null, (get, set) => {
    set(selectedSpokenLanguagesAtom, get(spokenLanguagesAtom))
  })

  const saveSelectedSpokenLanguagesActionAtom = atom(null, (get, set) => {
    set(spokenLanguagesAtom, get(selectedSpokenLanguagesAtom))
  })

  const updateAndRefreshLocationSuggestionsActionAtom = atom(
    null,
    (get, set, request: GetLocationSuggestionsRequest) => {
      return pipe(
        set(fetchLocationSuggestionsAtom, request),
        T.map((result) => {
          set(locationSuggestionsAtom, result.result)
        })
      )()
    }
  )

  const setOfferLocationActionAtom = atom(
    null,
    (get, set, locationSuggestionAtom: Atom<LocationSuggestion>) => {
      const location = get(locationAtom)
      const locationSuggestion = get(locationSuggestionAtom)

      if (
        !location?.some(
          (offerLocation) =>
            offerLocation.city === locationSuggestion.userData.suggestFirstRow
        )
      ) {
        set(locationAtom, [
          ...(location ?? []),
          {
            latitude: String(locationSuggestion.userData.latitude),
            longitude: String(locationSuggestion.userData.longitude),
            city: locationSuggestion.userData.suggestFirstRow,
          },
        ])
      }
    }
  )

  const loadingAtom = atom<boolean>(false)
  const encryptingOfferAtom = atom<boolean>(false)
  const createOfferProgressAtom = atom<OfferProgressState | undefined>(
    undefined
  )

  const createOfferActionAtom = atom(null, (get, set): T.Task<boolean> => {
    const {t} = get(translationAtom)
    const displayOfferCreationFeedback = get(displayOfferCreationFeedbackAtom)

    const {
      location,
      locationState,
      offerDescription,
      offerPublicKey,
      ...restOfPublicPart
    } = get(offerFormAtom)

    const intendedConnectionLevel = get(intendedConnectionLevelAtom)

    if (locationState === 'IN_PERSON' && location.length === 0) {
      Alert.alert(t('offerForm.errorLocationNotFilled'))
      return T.of(false)
    }

    if (offerDescription.trim() === '') {
      Alert.alert(t('offerForm.errorDescriptionNotFilled'))
      return T.of(false)
    }

    set(loadingAtom, true)
    set(encryptingOfferAtom, true)
    return pipe(
      generateKeyPair(),
      TE.fromEither,
      TE.bindTo('key'),
      TE.bindW('createdOffer', ({key}) =>
        set(createOfferAtom, {
          payloadPublic: {
            offerPublicKey: key.publicKeyPemBase64,
            location,
            locationState,
            offerDescription: offerDescription.trim(),
            ...restOfPublicPart,
          },
          intendedConnectionLevel: intendedConnectionLevel ?? 'FIRST',
          onProgress: (status) => {
            if (status.type === 'ENCRYPTING_PRIVATE_PAYLOADS')
              set(createOfferProgressAtom, {
                currentState: status.type,
                percentage: {
                  total: status.totalToEncrypt,
                  current: status.currentlyProcessingIndex,
                },
              })
            else
              set(createOfferProgressAtom, (old) => ({
                ...(old ?? {percentage: undefined}),
                currentState: status.type,
              }))
          },
        })
      ),
      TE.chainFirstW(({key, createdOffer}) =>
        set(createInboxAtom, {
          inbox: {
            privateKey: key,
            offerId: createdOffer.offerInfo.offerId,
          },
        })
      ),
      TE.matchW(
        (e) => {
          set(loadingAtom, false)
          set(encryptingOfferAtom, false)
          showErrorAlert({
            title:
              toCommonErrorMessage(e, t) ?? t('offerForm.errorCreatingOffer'),
            error: e,
          })
          return false
        },
        () => {
          set(loadingAtom, false)
          return true
        }
      ),
      T.chain(delayInPipeT(3000)),
      T.map((result) => {
        set(encryptingOfferAtom, false)
        if (!displayOfferCreationFeedback) {
          set(displayOfferCreationFeedbackAtom, true)
        }
        return result
      })
    )
  })

  const deleteOfferActionAtom = atom<null, [], T.Task<boolean>>(
    null,
    (get, set) => {
      const {t} = get(translationAtom)
      const offer = get(offerAtom)

      return pipe(
        set(deleteOffersActionAtom, {
          adminIds: [offer.ownershipInfo?.adminId].filter(notEmpty),
        }),
        TE.match(
          (e) => {
            showErrorAlert({
              title:
                toCommonErrorMessage(e, t) ?? t('editOffer.errorDeletingOffer'),
              error: e,
            })
            return false
          },
          (result) => {
            return result.success
          }
        )
      )
    }
  )

  const modifyOfferLoaderTitleAtom = atom((get) => {
    const {t} = get(translationAtom)
    const numberOfFriends = get(numberOfFriendsAtom)
    const intendedConnectionLevel = get(intendedConnectionLevelAtom)

    return pipe(
      numberOfFriends,
      E.match(
        (e) => {
          if (e._tag !== 'friendsNotLoaded') {
            showErrorAlert({
              title: toCommonErrorMessage(e, t) ?? t('common.unknownError'),
              error: e,
            })
          }

          return {
            loadingText: t('offerForm.noVexlersFoundForYourOffer'),
            notLoadingText: t('offerForm.noVexlersFoundForYourOffer'),
          }
        },
        (r) => {
          return {
            loadingText: t('offerForm.offerEncryption.forVexlers', {
              count:
                intendedConnectionLevel === 'FIRST'
                  ? r.firstLevelFriendsCount
                  : r.secondLevelFriendsCount,
            }),
            notLoadingText: t(
              'offerForm.offerEncryption.anonymouslyDeliveredToVexlers',
              {
                count:
                  intendedConnectionLevel === 'FIRST'
                    ? r.firstLevelFriendsCount
                    : r.secondLevelFriendsCount,
              }
            ),
          }
        }
      )
    )
  })

  const toggleOfferActiveAtom = atom(null, (get, set) => {
    const {t} = get(translationAtom)
    const offer = get(offerAtom)

    set(loadingAtom, true)
    set(encryptingOfferAtom, true)

    return pipe(
      set(updateOfferAtom, {
        payloadPublic: {
          ...offer.offerInfo.publicPart,
          active: !offer.offerInfo.publicPart.active,
        },
        adminId: offer.ownershipInfo?.adminId ?? ('' as OfferAdminId),
        symmetricKey: offer.offerInfo.privatePart.symmetricKey,
        intendedConnectionLevel: offer.ownershipInfo
          ? offer.ownershipInfo.intendedConnectionLevel
          : 'FIRST',
      }),
      TE.match(
        (e) => {
          set(loadingAtom, false)
          set(encryptingOfferAtom, false)
          showErrorAlert({
            title:
              toCommonErrorMessage(e, t) ??
              t('editOffer.offerUnableToChangeOfferActivation'),
            error: e,
          })
          return false
        },
        () => {
          set(loadingAtom, false)
          return true
        }
      ),
      T.chain(delayInPipeT(2000)),
      T.map((v) => {
        set(encryptingOfferAtom, false)
        return v
      })
    )
  })

  const editOfferAtom = atom(null, (get, set) => {
    const {t} = get(translationAtom)
    const offer = get(offerAtom)

    const {locationState, location, offerDescription, ...restOfPublicPart} =
      get(offerFormAtom)
    const intendedConnectionLevel = get(intendedConnectionLevelAtom)

    if (locationState === 'IN_PERSON' && location.length === 0) {
      Alert.alert(t('offerForm.errorLocationNotFilled'))
      return T.of(false)
    }

    if (offerDescription.trim() === '') {
      Alert.alert(t('offerForm.errorDescriptionNotFilled'))
      return T.of(false)
    }

    set(loadingAtom, true)
    set(encryptingOfferAtom, true)

    return pipe(
      set(updateOfferAtom, {
        payloadPublic: {
          ...restOfPublicPart,
          location,
          locationState,
          offerDescription: offerDescription.trim(),
        },
        adminId: offer.ownershipInfo?.adminId ?? ('' as OfferAdminId),
        symmetricKey: offer.offerInfo.privatePart.symmetricKey,
        intendedConnectionLevel: intendedConnectionLevel ?? 'FIRST',
      }),
      TE.match(
        (e) => {
          set(loadingAtom, false)
          set(encryptingOfferAtom, false)
          showErrorAlert({
            title:
              toCommonErrorMessage(e, t) ?? t('editOffer.errorEditingOffer'),
            error: e,
          })
          return false
        },
        () => {
          set(loadingAtom, false)
          return true
        }
      ),
      T.chain(delayInPipeT(2000)),
      T.map((v) => {
        set(encryptingOfferAtom, false)
        return v
      })
    )
  })

  const resetOfferFormActionAtom = atom(null, (get, set) => {
    set(offerAtom, dummyOffer)
    set(nullableOfferTypeAtom, undefined)
    set(nullableCurrencyAtom, dummyOffer.offerInfo.publicPart.currency)
    set(
      nullableAmountTopLimitAtom,
      dummyOffer.offerInfo.publicPart.amountTopLimit
    )
    set(
      nullableAmountBottomLimitAtom,
      dummyOffer.offerInfo.publicPart.amountBottomLimit
    )
    set(nullableBtcNetworkAtom, dummyOffer.offerInfo.publicPart.btcNetwork)
    set(
      nullablePaymentMethodAtom,
      dummyOffer.offerInfo.publicPart.paymentMethod
    )
    set(
      nullableLocationStateAtom,
      dummyOffer.offerInfo.publicPart.locationState
    )
    set(nullableLocationAtom, dummyOffer.offerInfo.publicPart.location)
  })

  return {
    offerAtom,
    showAllFieldsAtom,
    offerFormAtom,
    deleteOfferActionAtom,
    intendedConnectionLevelAtom,
    modifyOfferLoaderTitleAtom,
    loadingAtom,
    encryptingOfferAtom,
    toggleOfferActiveAtom,
    editOfferAtom,
    createOfferActionAtom,
    currencyAtom,
    amountBottomLimitAtom,
    amountTopLimitAtom,
    offerTypeAtom,
    feeAmountAtom,
    feeStateAtom,
    locationStateAtom,
    locationAtom,
    btcNetworkAtom,
    paymentMethodAtom,
    offerDescriptionAtom,
    offerActiveAtom,
    updateCurrencyLimitsAtom,
    updateLocationStatePaymentMethodAtom,
    createOfferProgressAtom,
    locationSuggestionsAtom,
    locationSuggestionsAtomsAtom,
    updateAndRefreshLocationSuggestionsActionAtom,
    setOfferLocationActionAtom,
    resetOfferFormActionAtom,
    offerTypeOrDummyValueAtom,
    spokenLanguagesAtom,
    spokenLanguagesAtomsAtom,
    removeSpokenLanguageActionAtom,
    createIsThisLanguageSelectedAtom,
    selectedSpokenLanguagesAtom,
    resetSelectedSpokenLanguagesActionAtom,
    saveSelectedSpokenLanguagesActionAtom,
  }
})
