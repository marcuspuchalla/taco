/**
 * useCborDiagnostic - RFC 8949 Appendix B Diagnostic Notation
 *
 * Converts CBOR values to human-readable diagnostic notation as defined
 * in RFC 8949 (Concise Binary Object Representation).
 *
 * @example
 * ```typescript
 * const { toDiagnostic } = useCborDiagnostic()
 *
 * toDiagnostic(100)                    // "100"
 * toDiagnostic(new Uint8Array([1,2]))  // "h'0102'"
 * toDiagnostic([1, 2, 3])              // "[1, 2, 3]"
 * toDiagnostic({a: 1})                 // '{"a": 1}'
 * ```
 */

/**
 * Options for diagnostic notation output
 */
export interface DiagnosticOptions {
  /** Pretty print with indentation (default: false) */
  pretty?: boolean
  /** Indentation string for pretty printing (default: '  ') */
  indent?: string
  /** Maximum depth for nested structures (default: 100) */
  maxDepth?: number
  /** Mark as indefinite-length (default: false) */
  indefinite?: boolean
  /** Show byte offsets as comments (default: false) */
  showOffsets?: boolean
}

/**
 * Tagged value interface (CBOR Major Type 6)
 */
interface TaggedValue {
  tag: number
  value: unknown
}

/**
 * Check if value is a tagged value
 */
function isTaggedValue(value: unknown): value is TaggedValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tag' in value &&
    'value' in value &&
    typeof (value as TaggedValue).tag === 'number'
  )
}

/**
 * Check if value is a plain object (not array, not special type)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array) &&
    !(value instanceof Map) &&
    !(value instanceof Set) &&
    !isTaggedValue(value) &&
    value.constructor === Object
  )
}

/**
 * Escape string for diagnostic notation (JSON-style escaping)
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => {
      const code = char.charCodeAt(0)
      return `\\u${code.toString(16).padStart(4, '0')}`
    })
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Composable for CBOR diagnostic notation
 */
export function useCborDiagnostic() {
  /**
   * Convert a CBOR value to RFC 8949 diagnostic notation
   *
   * @param value - The CBOR value to convert
   * @param options - Formatting options
   * @returns Diagnostic notation string
   */
  const toDiagnostic = (
    value: unknown,
    options: DiagnosticOptions = {}
  ): string => {
    const {
      pretty = false,
      indent = '  ',
      maxDepth = 100,
      indefinite = false
    } = options

    return formatValue(value, 0, pretty, indent, maxDepth, indefinite)
  }

  /**
   * Internal recursive formatter
   */
  const formatValue = (
    value: unknown,
    depth: number,
    pretty: boolean,
    indent: string,
    maxDepth: number,
    indefinite: boolean
  ): string => {
    // Check depth limit
    if (depth > maxDepth) {
      return '...'
    }

    // Handle null/undefined
    if (value === null) {
      return 'null'
    }
    if (value === undefined) {
      return 'undefined'
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }

    // Handle numbers
    if (typeof value === 'number') {
      // Special float values
      if (Number.isNaN(value)) {
        return 'NaN'
      }
      if (value === Infinity) {
        return 'Infinity'
      }
      if (value === -Infinity) {
        return '-Infinity'
      }
      // Negative zero
      if (Object.is(value, -0)) {
        return '-0.0'
      }
      // Regular numbers
      if (Number.isInteger(value)) {
        return value.toString()
      }
      // Floats - preserve precision
      return value.toString()
    }

    // Handle BigInt
    if (typeof value === 'bigint') {
      return value.toString()
    }

    // Handle strings
    if (typeof value === 'string') {
      return `"${escapeString(value)}"`
    }

    // Handle byte strings (Uint8Array)
    if (value instanceof Uint8Array) {
      return `h'${bytesToHex(value)}'`
    }

    // Handle tagged values
    if (isTaggedValue(value)) {
      const taggedContent = formatValue(
        value.value,
        depth + 1,
        pretty,
        indent,
        maxDepth,
        false
      )
      return `${value.tag}(${taggedContent})`
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return indefinite ? '[_ ]' : '[]'
      }

      const items = value.map(item =>
        formatValue(item, depth + 1, pretty, indent, maxDepth, false)
      )

      if (pretty) {
        const prefix = indefinite ? '[_ ' : '['
        const lineIndent = indent.repeat(depth + 1)
        const closeIndent = indent.repeat(depth)
        return `${prefix}\n${lineIndent}${items.join(`,\n${lineIndent}`)}\n${closeIndent}]`
      } else {
        const prefix = indefinite ? '[_ ' : '['
        return `${prefix}${items.join(', ')}]`
      }
    }

    // Handle Maps
    if (value instanceof Map) {
      if (value.size === 0) {
        return indefinite ? '{_ }' : '{}'
      }

      const entries: string[] = []
      for (const [k, v] of value) {
        const keyStr = formatValue(k, depth + 1, pretty, indent, maxDepth, false)
        const valueStr = formatValue(v, depth + 1, pretty, indent, maxDepth, false)
        entries.push(`${keyStr}: ${valueStr}`)
      }

      if (pretty) {
        const prefix = indefinite ? '{_ ' : '{'
        const lineIndent = indent.repeat(depth + 1)
        const closeIndent = indent.repeat(depth)
        return `${prefix}\n${lineIndent}${entries.join(`,\n${lineIndent}`)}\n${closeIndent}}`
      } else {
        const prefix = indefinite ? '{_ ' : '{'
        return `${prefix}${entries.join(', ')}}`
      }
    }

    // Handle Sets (convert to array)
    if (value instanceof Set) {
      const items = Array.from(value).map(item =>
        formatValue(item, depth + 1, pretty, indent, maxDepth, false)
      )

      if (pretty) {
        const lineIndent = indent.repeat(depth + 1)
        const closeIndent = indent.repeat(depth)
        return `[\n${lineIndent}${items.join(`,\n${lineIndent}`)}\n${closeIndent}]`
      } else {
        return `[${items.join(', ')}]`
      }
    }

    // Handle plain objects (as CBOR maps with string keys)
    if (isPlainObject(value)) {
      const keys = Object.keys(value)
      if (keys.length === 0) {
        return indefinite ? '{_ }' : '{}'
      }

      const entries = keys.map(key => {
        const keyStr = `"${escapeString(key)}"`
        const valueStr = formatValue(
          value[key],
          depth + 1,
          pretty,
          indent,
          maxDepth,
          false
        )
        return `${keyStr}: ${valueStr}`
      })

      if (pretty) {
        const prefix = indefinite ? '{_ ' : '{'
        const lineIndent = indent.repeat(depth + 1)
        const closeIndent = indent.repeat(depth)
        return `${prefix}\n${lineIndent}${entries.join(`,\n${lineIndent}`)}\n${closeIndent}}`
      } else {
        const prefix = indefinite ? '{_ ' : '{'
        return `${prefix}${entries.join(', ')}}`
      }
    }

    // Fallback for unknown types
    return String(value)
  }

  /**
   * Parse diagnostic notation back to CBOR value
   * (Not fully implemented - for future use)
   */
  const fromDiagnostic = (diag: string): unknown => {
    // Basic parsing for common cases
    const trimmed = diag.trim()

    // Null/undefined
    if (trimmed === 'null') return null
    if (trimmed === 'undefined') return undefined

    // Booleans
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false

    // Special floats
    if (trimmed === 'NaN') return NaN
    if (trimmed === 'Infinity') return Infinity
    if (trimmed === '-Infinity') return -Infinity

    // Numbers (including negative zero)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed)
      if (trimmed === '-0.0' || trimmed === '-0') {
        return -0
      }
      return num
    }

    // Byte strings h'...'
    const hexMatch = trimmed.match(/^h'([0-9a-fA-F]*)'$/)
    if (hexMatch && hexMatch[1] !== undefined) {
      const hex = hexMatch[1]
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
      }
      return bytes
    }

    // Strings "..."
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      // Basic unescape - full implementation would handle all escapes
      return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }

    // For arrays, maps, tags - would need full parser
    // Return as string for now
    return trimmed
  }

  /**
   * Format value with type annotation (extended notation)
   */
  const toDiagnosticWithType = (
    value: unknown,
    majorType: number,
    options: DiagnosticOptions = {}
  ): string => {
    const typeNames: Record<number, string> = {
      0: 'uint',
      1: 'nint',
      2: 'bstr',
      3: 'tstr',
      4: 'array',
      5: 'map',
      6: 'tag',
      7: 'simple'
    }

    const typeName = typeNames[majorType] || 'unknown'
    const diag = toDiagnostic(value, options)

    return `${typeName}(${diag})`
  }

  return {
    toDiagnostic,
    fromDiagnostic,
    toDiagnosticWithType
  }
}

export default useCborDiagnostic
