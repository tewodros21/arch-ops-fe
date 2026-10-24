import { djangoBackend } from './django'
import type { Backend } from './types'

/** The Django REST API (public/docs/openapi.yaml) */
export const backend: Backend = djangoBackend

export { API_BASE_URL } from './config'
export type * from './types'
