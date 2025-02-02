import {XStack} from 'tamagui'
import {useTranslation} from '../../../utils/localization/I18nProvider'
import ContactsFilterButton from './ContactsFilterButton'
import {contactSelectMolecule} from '../atom'
import {useMolecule} from 'jotai-molecules'

function ContactsFilter(): JSX.Element {
  const {t} = useTranslation()
  const {
    showNewContactsAtom,
    showSubmittedContactsAtom,
    showNonSubmittedContactsAtom,
  } = useMolecule(contactSelectMolecule)

  return (
    <XStack ai={'center'} space={'$2'}>
      <ContactsFilterButton
        isSelectedAtom={showSubmittedContactsAtom}
        title={t('postLoginFlow.contactsList.submitted')}
      />
      <ContactsFilterButton
        isSelectedAtom={showNonSubmittedContactsAtom}
        title={t('postLoginFlow.contactsList.nonSubmitted')}
      />
      <ContactsFilterButton
        isSelectedAtom={showNewContactsAtom}
        title={t('postLoginFlow.contactsList.new')}
      />
    </XStack>
  )
}

export default ContactsFilter
