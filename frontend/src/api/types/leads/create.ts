import { Lead } from './lead'

export type LeadsCreateInput = {
  firstName: string
  lastName: string
  email: string
}

export type LeadsCreateOutput = Lead
