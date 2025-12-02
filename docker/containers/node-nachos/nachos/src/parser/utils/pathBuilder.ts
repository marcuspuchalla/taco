/**
 * PathBuilder - Utilities for creating and manipulating source map paths
 *
 * Path format follows JSON Pointer (RFC 6901) with CBOR-specific extensions:
 * - Array indices: [0], [1], [2]
 * - Object/Map keys: .key, .nested.key
 * - Special markers: [#header], [#content], [#value]
 *
 * @example
 * ```typescript
 * import { PathBuilder } from './pathBuilder'
 *
 * const path = PathBuilder.arrayIndex('', 0)        // "[0]"
 * const nested = PathBuilder.arrayIndex(path, 1)   // "[0][1]"
 * const key = PathBuilder.mapKey(nested, 'amount') // "[0][1].amount"
 * const header = PathBuilder.header(key)           // "[0][1].amount[#header]"
 * ```
 */

/**
 * PathBuilder utility object with methods for creating and manipulating paths
 */
export const PathBuilder = {
  /**
   * Create root path (empty string)
   */
  root: (): string => '',

  /**
   * Create path for array index
   * @param parent - Parent path
   * @param index - Array index (0-based)
   * @returns Path string like "[0]" or "[0][1]"
   */
  arrayIndex: (parent: string, index: number): string => `${parent}[${index}]`,

  /**
   * Create path for map/object key
   * @param parent - Parent path
   * @param key - Key name (string or number)
   * @returns Path string like ".key" or "[0].key"
   */
  mapKey: (parent: string, key: string | number): string => {
    const keyStr = String(key)
    // Escape special characters in key names
    const escapedKey = keyStr.replace(/[.\[\]\\]/g, '\\$&')
    return parent ? `${parent}.${escapedKey}` : `.${escapedKey}`
  },

  /**
   * Create path for map key by index (for non-string keys)
   * @param parent - Parent path
   * @param index - Key index in map
   * @returns Path string like "[#key:0]"
   */
  mapKeyIndex: (parent: string, index: number): string =>
    `${parent}[#key:${index}]`,

  /**
   * Create path for header portion of a value
   * Used for byte strings, text strings, arrays, maps, tags
   * @param parent - Parent path
   * @returns Path string like "[0][#header]"
   */
  header: (parent: string): string => `${parent}[#header]`,

  /**
   * Create path for content portion of a value
   * Used for byte strings and text strings
   * @param parent - Parent path
   * @returns Path string like "[0][#content]"
   */
  content: (parent: string): string => `${parent}[#content]`,

  /**
   * Create path for tagged value
   * @param parent - Parent path
   * @returns Path string like "[0][#value]"
   */
  tagValue: (parent: string): string => `${parent}[#value]`,

  /**
   * Normalize a path by removing special markers (#header, #content, #value)
   * Used for matching paths across different representations
   * @param path - Path to normalize
   * @returns Normalized path without special markers
   */
  normalize: (path: string): string => {
    return path.replace(/\[#(header|content|value)\]$/, '')
  },

  /**
   * Check if path is a header path
   * @param path - Path to check
   * @returns True if path ends with [#header]
   */
  isHeader: (path: string): boolean => path.endsWith('[#header]'),

  /**
   * Check if path is a content path
   * @param path - Path to check
   * @returns True if path ends with [#content]
   */
  isContent: (path: string): boolean => path.endsWith('[#content]'),

  /**
   * Check if path is a tag value path
   * @param path - Path to check
   * @returns True if path ends with [#value]
   */
  isTagValue: (path: string): boolean => path.endsWith('[#value]'),

  /**
   * Check if path has any special marker
   * @param path - Path to check
   * @returns True if path ends with any special marker
   */
  hasMarker: (path: string): boolean =>
    /\[#(header|content|value)\]$/.test(path),

  /**
   * Get parent path (one level up)
   * @param path - Path to get parent of
   * @returns Parent path or null if already at root
   */
  getParent: (path: string): string | null => {
    // First normalize to remove markers
    const normalized = PathBuilder.normalize(path)
    if (normalized === '') return null

    // Match array index or object key at end
    const arrayMatch = normalized.match(/^(.+)\[\d+\]$/)
    if (arrayMatch && arrayMatch[1] !== undefined) return arrayMatch[1]

    const keyMatch = normalized.match(/^(.+)\.[^.]+$/)
    if (keyMatch && keyMatch[1] !== undefined) return keyMatch[1]

    // Root level item
    if (normalized.startsWith('[') || normalized.startsWith('.')) {
      return ''
    }

    return null
  },

  /**
   * Get the depth (nesting level) of a path
   * @param path - Path to measure
   * @returns Number indicating nesting depth (0 for root)
   */
  getDepth: (path: string): number => {
    const normalized = PathBuilder.normalize(path)
    if (normalized === '') return 0

    // Count array indices and object keys
    const arrayDepth = (normalized.match(/\[\d+\]/g) || []).length
    const keyDepth = (normalized.match(/\./g) || []).length

    return arrayDepth + keyDepth
  },

  /**
   * Parse a path into its components
   * @param path - Path to parse
   * @returns Array of path segments
   */
  parse: (path: string): Array<{ type: 'index' | 'key' | 'marker'; value: string | number }> => {
    const normalized = PathBuilder.normalize(path)
    const segments: Array<{ type: 'index' | 'key' | 'marker'; value: string | number }> = []

    // Check for marker
    const markerMatch = path.match(/\[#(header|content|value)\]$/)

    // Parse the normalized path
    let remaining = normalized
    while (remaining) {
      // Array index
      const indexMatch = remaining.match(/^\[(\d+)\]/)
      if (indexMatch && indexMatch[1] !== undefined) {
        segments.push({ type: 'index', value: parseInt(indexMatch[1], 10) })
        remaining = remaining.slice(indexMatch[0].length)
        continue
      }

      // Object key
      const keyMatch = remaining.match(/^\.([^.\[\]]+)/)
      if (keyMatch && keyMatch[1] !== undefined) {
        // Unescape special characters
        const key = keyMatch[1].replace(/\\(.)/g, '$1')
        segments.push({ type: 'key', value: key })
        remaining = remaining.slice(keyMatch[0].length)
        continue
      }

      // Unknown format, break to avoid infinite loop
      break
    }

    // Add marker if present
    if (markerMatch && markerMatch[1] !== undefined) {
      segments.push({ type: 'marker', value: markerMatch[1] })
    }

    return segments
  },

  /**
   * Build a path from segments
   * @param segments - Array of path segments
   * @returns Path string
   */
  build: (segments: Array<{ type: 'index' | 'key' | 'marker'; value: string | number }>): string => {
    let path = ''

    for (const segment of segments) {
      if (segment.type === 'index') {
        path += `[${segment.value}]`
      } else if (segment.type === 'key') {
        const escapedKey = String(segment.value).replace(/[.\[\]\\]/g, '\\$&')
        path += `.${escapedKey}`
      } else if (segment.type === 'marker') {
        path += `[#${segment.value}]`
      }
    }

    return path
  },

  /**
   * Join multiple path segments
   * @param paths - Path segments to join
   * @returns Combined path
   */
  join: (...paths: string[]): string => {
    return paths.filter(p => p !== '').join('')
  },

  /**
   * Check if a path is a descendant of another path
   * @param path - Path to check
   * @param ancestor - Potential ancestor path
   * @returns True if path is a descendant of ancestor
   */
  isDescendantOf: (path: string, ancestor: string): boolean => {
    const normalizedPath = PathBuilder.normalize(path)
    const normalizedAncestor = PathBuilder.normalize(ancestor)

    if (normalizedAncestor === '') {
      return normalizedPath !== ''
    }

    return normalizedPath.startsWith(normalizedAncestor) &&
           normalizedPath.length > normalizedAncestor.length &&
           (normalizedPath[normalizedAncestor.length] === '[' ||
            normalizedPath[normalizedAncestor.length] === '.')
  }
}

export default PathBuilder
