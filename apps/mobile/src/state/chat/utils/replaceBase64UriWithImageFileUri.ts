import * as TE from 'fp-ts/TaskEither'
import {type ChatMessageWithState} from '../domain'
import {pipe} from 'fp-ts/function'
import {generateUuid} from '@vexl-next/domain/dist/utility/Uuid.brand'
import * as E from 'fp-ts/Either'
import * as T from 'fp-ts/Task'
import {UriString} from '@vexl-next/domain/dist/utility/UriString.brand'
import * as FileSystem from 'expo-file-system'
import {
  type BasicError,
  toBasicError,
} from '@vexl-next/domain/dist/utility/errors'
import urlJoin from 'url-join'
import {safeParse} from '../../../utils/fpUtils'
import reportError from '../../../utils/reportError'
import {type PublicKeyPemBase64} from '@vexl-next/cryptography/dist/KeyHolder'
import {
  hashMD5,
  type CryptoError,
} from '@vexl-next/resources-utils/dist/utils/crypto'

const IMAGES_DIRECTORY = 'chat-images'

type NoDocumentDirectoryError = BasicError<'NoDocumentDirectoryError'>
type CreatingDirectoryError = BasicError<'CreatingDirectoryError'>
type ProcessingBase64Error = BasicError<'ProcessingBase64Error'>
type WritingFileError = BasicError<'WritingFileError'>
type BadFileName = BasicError<'BadFileName'>

function base64StringToContentAndMimeType(base64: UriString): E.Either<
  ProcessingBase64Error,
  {
    content: string
    suffix: string
  }
> {
  return E.tryCatch(() => {
    const [prefix, base64Content] = base64.split(',')
    const suffix = prefix?.match(/:image\/(.+?);/)?.at(1)

    if (!suffix || !base64Content) throw Error('Not valid base64')

    return {content: base64Content, suffix}
  }, toBasicError('ProcessingBase64Error'))
}

function documentDirectoryOrLeft(): E.Either<
  NoDocumentDirectoryError,
  UriString
> {
  const parseResult = UriString.safeParse(FileSystem.documentDirectory)
  if (parseResult.success) {
    return E.right(parseResult.data)
  }
  return E.left({
    _tag: 'NoDocumentDirectoryError',
    error: new Error(
      'Could not get document directory. FileSystem.documentDirectory is not a valid UriString'
    ),
  })
}

function createDirectoryIfItDoesNotExist(
  dir: string
): TE.TaskEither<CreatingDirectoryError, true> {
  return TE.tryCatch(async () => {
    const dirInfo = await FileSystem.getInfoAsync(dir)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, {intermediates: true})
    }

    return true as const
  }, toBasicError('CreatingDirectoryError'))
}

function writeAsStringAsync({
  content,
  path,
}: {
  content: string
  path: string
}): TE.TaskEither<WritingFileError, true> {
  return TE.tryCatch(async () => {
    await FileSystem.writeAsStringAsync(path, content, {
      encoding: FileSystem.EncodingType.Base64,
    })
    return true as const
  }, toBasicError('WritingFileError'))
}

function saveBase64ImageToStorage(
  base64: UriString,
  inboxPublicKey: PublicKeyPemBase64
): TE.TaskEither<
  | NoDocumentDirectoryError
  | ProcessingBase64Error
  | BadFileName
  | WritingFileError
  | CreatingDirectoryError
  | CryptoError,
  UriString
> {
  return pipe(
    E.Do,
    E.bindW('documentDir', documentDirectoryOrLeft),
    E.bindW('content', () => base64StringToContentAndMimeType(base64)),
    E.bindW('fileName', ({content: {suffix}}) =>
      E.right(`${generateUuid()}.${suffix}`)
    ),
    E.bindW('inboxPath', () => hashMD5(inboxPublicKey)),
    E.bindW('directoryPath', ({documentDir, inboxPath}) =>
      E.right(urlJoin(documentDir, IMAGES_DIRECTORY, inboxPath))
    ),
    E.bindW('filePath', ({directoryPath, fileName}) => {
      return pipe(
        E.right(urlJoin(directoryPath, fileName)),
        E.chainW(safeParse(UriString)),
        E.mapLeft(toBasicError('BadFileName'))
      )
    }),
    TE.fromEither,
    TE.chainFirstW(({directoryPath}) =>
      createDirectoryIfItDoesNotExist(directoryPath)
    ),
    TE.chainFirstW(({documentDir, content, filePath}) =>
      writeAsStringAsync({content: content.content, path: filePath})
    ),
    TE.map((one) => one.filePath)
  )
}

function replaceImage(
  source: ChatMessageWithState
): (image: UriString) => ChatMessageWithState {
  return (image: UriString) => {
    if (!source.message.deanonymizedUser) return source
    return {
      ...source,
      message: {
        ...source.message,
        image,
      },
    }
  }
}

export default function replaceBase64UriWithImageFileUri(
  message: ChatMessageWithState,
  inboxPublicKey: PublicKeyPemBase64
): T.Task<ChatMessageWithState> {
  const image = message.message.image

  if (!image) return T.of(message)

  return pipe(
    saveBase64ImageToStorage(image, inboxPublicKey),
    TE.map(replaceImage(message)),
    TE.match(
      (e) => {
        reportError(
          'error',
          'Error while processing message with identity reveal',
          e
        )
        return message
      },
      (one) => one
    )
  )
}
