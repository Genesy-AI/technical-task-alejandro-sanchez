import { Lead } from './lead'

export type LeadsGetOneInput = {
  id: number
}

/** `null` when no lead has this id. */
export type LeadsGetOneOutput = Lead | null
