/*
* Websocket operation codes are used only for server-to-client communication.
* */
export enum WebSocketOpCode {
  ForceClientRefresh = 1000,
  UserSettingsUpdate,
  UserPlanUpdate,

  MessageCreate = 10100,
  MessageUpdate,
  MessageDelete,

  ConversationCreate = 10110,
  ConversationUpdate,
  ConversationDelete,
}
