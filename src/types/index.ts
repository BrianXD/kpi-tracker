export interface User {
  id: string
  empId: string
  name: string
  loginId: string
}

export interface System {
  id: string
  name: string
  order: number
}

export interface SubModule {
  id: string
  parentSystem: string
  name: string
  order: number
}

export interface QuestionType {
  id: string
  name: string
  order: number
}

export interface Employee {
  id: string
  empId: string
  name: string
}

export interface FormOptions {
  systems: System[]
  subModules: SubModule[]
  questionTypes: QuestionType[]
  employees: Employee[]
}

export type Level = 'HIGH' | 'MID' | 'LOW'

export interface WorkItemPayload {
  system: string
  subModule: string
  handler: string
  questioner: string
  difficulty: Level
  priority: Level
  questionDate: string
  questionType: string
  isDone: boolean
  closedDate?: string
  minutes?: number
  note?: string
}
