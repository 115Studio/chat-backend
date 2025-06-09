import { EventEnvironment } from '../../environment'

export const getDo = (e: EventEnvironment, id: string) => {
  const doId = e.USER_DURABLE_OBJECT.idFromName(id)
  const doInstance = e.USER_DURABLE_OBJECT.get(doId)

  return { doId, doStub: doInstance }
}
