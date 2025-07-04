/*
 * Websocket operation codes are used only for server-to-client communication.
 * */
export enum WebSocketOpCode {
  Heartbeat,
  ForceClientRefresh = 1000,
  UserSettingsUpdate,
  UserPlanUpdate,
  ServerHello,
  SyncInput,

  MessageCreate = 10100,
  MessageUpdate,
  MessageComplement,
  MessageStageUpdate,
  MessageDelete,

  ChannelCreate = 10110,
  ChannelUpdate,
  ChannelDelete,

  UserUpdate = 10120,

  PersonalityCreated = 10130,
  PersonalityUpdated,
  PersonalityDeleted,

  BYOKCreated = 10140,
  BYOKUpdated,
  BYOKDeleted,
}
