/**
 * Circular Buffer for efficient data buffering
 *
 * Features:
 * - Fixed-capacity storage with O(1) operations
 * - Head/tail pointer management
 * - No string concatenation overhead
 * - Memory-efficient with automatic wrapping
 */
export class CircularBuffer {
  private buffer: string[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private readonly capacity: number;

  constructor(capacity: number = 50) {
    if (capacity <= 0) {
      throw new Error('CircularBuffer capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Push data into the buffer
   * Returns true if successful, false if buffer is full
   */
  public push(data: string): boolean {
    if (this.isFull()) {
      // Auto-expand strategy: when full, we can either reject or overwrite
      // For terminal data, we prefer to overwrite oldest data
      this.buffer[this.tail] = data;
      this.tail = (this.tail + 1) % this.capacity;
      this.head = (this.head + 1) % this.capacity; // Move head forward too
      return true;
    }

    this.buffer[this.tail] = data;
    this.tail = (this.tail + 1) % this.capacity;
    this.size++;
    return true;
  }

  /**
   * Flush all data from the buffer and return as a single string
   * Clears the buffer after flushing
   */
  public flush(): string {
    if (this.isEmpty()) {
      return '';
    }

    const result: string[] = [];
    let current = this.head;

    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[current]);
      current = (current + 1) % this.capacity;
    }

    this.clear();
    return result.join('');
  }

  /**
   * Peek at the buffer contents without flushing
   */
  public peek(): string {
    if (this.isEmpty()) {
      return '';
    }

    const result: string[] = [];
    let current = this.head;

    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[current]);
      current = (current + 1) % this.capacity;
    }

    return result.join('');
  }

  /**
   * Clear the buffer
   */
  public clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    // Don't null out the array elements - just reset pointers
    // This is more memory efficient for reuse
  }

  /**
   * Check if buffer is empty
   */
  public isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Check if buffer is full
   */
  public isFull(): boolean {
    return this.size === this.capacity;
  }

  /**
   * Get current number of items in buffer
   */
  public getSize(): number {
    return this.size;
  }

  /**
   * Get buffer capacity
   */
  public getCapacity(): number {
    return this.capacity;
  }

  /**
   * Get total data length in bytes (approximate)
   */
  public getDataLength(): number {
    let totalLength = 0;
    let current = this.head;

    for (let i = 0; i < this.size; i++) {
      totalLength += this.buffer[current]?.length || 0;
      current = (current + 1) % this.capacity;
    }

    return totalLength;
  }
}
