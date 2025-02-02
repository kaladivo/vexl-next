import {storage} from './fpMmkv'
import {getDefaultStore} from 'jotai'
import {messagingStateAtomStorageAtom} from '../state/chat/atoms/messagingStateAtom'
import connectionStateAtom from '../state/connections/atom/connectionStateAtom'
import {UnixMilliseconds} from '@vexl-next/domain/dist/utility/UnixMilliseconds.brand'
import offerToConnectionsAtom from '../state/connections/atom/offerToConnectionsAtom'
import {
  combinedContactsAfterLastSubmitStorageAtom,
  importedContactsStorageAtom,
} from '../state/contacts'
import {offersStateAtom} from '../state/marketplace/atom'
import {MINIMAL_DATE} from '@vexl-next/domain/dist/utility/IsoDatetimeString.brand'
import {postLoginFinishedStorageAtom} from '../state/postLoginOnboarding'
import {selectedCurrencyStorageAtom} from '../state/selectedCurrency'
import {preferencesAtom} from './preferences'
import {type OneOfferInState} from '@vexl-next/domain/dist/general/offers'
import {previousSearchesAtom} from '../components/SearchOffersScreen/atoms/previousSearchesAtom'
import {displayedNotificationsAtom} from '../state/displayedNotifications'
import {
  chatsToFeedbacksStorageAtom,
  offerFeedbackDoneStorageAtom,
} from '../state/feedback/atoms'

export default function clearMmkvStorageAndEmptyAtoms(): void {
  // TODO:#110 find a better way how to clear the state

  getDefaultStore().set(messagingStateAtomStorageAtom, {messagingState: []})
  getDefaultStore().set(connectionStateAtom, {
    lastUpdate: UnixMilliseconds.parse(0),
    firstLevel: [],
    secondLevel: [],
    commonFriends: {commonContacts: []},
  })
  getDefaultStore().set(offerToConnectionsAtom, {
    offerToConnections: [],
  })
  getDefaultStore().set(chatsToFeedbacksStorageAtom, {
    chatsToFeedbacks: [],
  })
  getDefaultStore().set(offerFeedbackDoneStorageAtom, {
    offerFeedbackDone: false,
  })
  getDefaultStore().set(importedContactsStorageAtom, {
    importedContacts: [],
  })
  getDefaultStore().set(combinedContactsAfterLastSubmitStorageAtom, {
    combinedContactsAfterLastSubmit: null,
  })
  getDefaultStore().set(offersStateAtom, {
    lastUpdatedAt: MINIMAL_DATE,
    offers: [] as OneOfferInState[],
  })
  getDefaultStore().set(postLoginFinishedStorageAtom, {
    postLoginFinished: false,
  })
  getDefaultStore().set(selectedCurrencyStorageAtom, {
    currency: 'USD',
  })
  getDefaultStore().set(preferencesAtom, {
    showDebugNotifications: false,
    disableOfferRerequestLimit: false,
    allowSendingImages: false,
    notificationPreferences: {
      marketing: true,
      chat: true,
      inactivityWarnings: true,
      marketplace: true,
      newOfferInMarketplace: true,
      newPhoneContacts: true,
      offer: true,
    },
    enableNewOffersNotificationDevMode: false,
    showFriendLevelBanner: true,
    tradeChecklistEnabled: false,
  })

  getDefaultStore().set(previousSearchesAtom, [])

  getDefaultStore().set(displayedNotificationsAtom, [])

  storage._storage.clearAll()
}
