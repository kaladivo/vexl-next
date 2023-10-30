import {useState} from 'react'
import {Image} from 'react-native'
import {Stack, Text} from 'tamagui'
import {type LoginStackScreenProps} from '../../../../navigationTypes'
import SvgImage from '../../../Image'
import {
  HeaderProxy,
  NextButtonProxy,
} from '../../../PageWithButtonAndProgressHeader'
import ProgressJourney from '../../../ProgressJourney'
import useContent from './useContent'

type Props = LoginStackScreenProps<'Intro'>

function Intro({navigation}: Props): JSX.Element {
  const [page, setPage] = useState(0)
  const content = useContent()

  const svg = content[page]?.svg
  const image = content[page]?.image

  return (
    <Stack f={1}>
      <HeaderProxy hidden showBackButton={false} progressNumber={1} />
      <ProgressJourney
        currentPage={page}
        numberOfPages={content.length}
        onPageChange={setPage}
        onFinish={() => {
          navigation.replace('Start')
        }}
        onSkip={() => {
          navigation.replace('Start')
        }}
      >
        <Stack f={1}>
          {svg && <SvgImage source={svg} />}
          {image && (
            <Image style={{flex: 1}} resizeMode="contain" source={image} />
          )}
        </Stack>
        <Stack h={150} maw={350} jc="flex-end">
          <Text color="$black" fontSize={24} ff="$heading">
            {content[page]?.title}
          </Text>
        </Stack>
      </ProgressJourney>
      <NextButtonProxy text={null} disabled={true} onPress={null} />
    </Stack>
  )
}

export default Intro
