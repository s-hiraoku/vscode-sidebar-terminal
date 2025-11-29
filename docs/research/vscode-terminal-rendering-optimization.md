# VS Code ターミナルレンダリング最適化実装パターン

VS Codeの公式ターミナル実装から学ぶ、効率的なレンダリングとスクロールバック管理の詳細パターン。

**参照元**: `microsoft/vscode` - `src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts`

---

## 1. ターミナルレンダリング最適化

### 1.1 スムーススクロールの制御

VS Codeは物理マウスホイールとトラックパッドを区別し、デバイスに応じてスムーススクロールを最適化します。

```typescript
// レンダリング定数
const enum RenderConstants {
    SmoothScrollDuration = 125  // 125msのスムーススクロール期間
}

private _isPhysicalMouseWheel = MouseWheelClassifier.INSTANCE.isPhysicalMouseWheel();

// スムーススクロールの動的更新
private _updateSmoothScrolling() {
    this.raw.options.smoothScrollDuration =
        this._terminalConfigurationService.config.smoothScrolling &&
        this._isPhysicalMouseWheel
            ? RenderConstants.SmoothScrollDuration
            : 0;
}

// マウスホイールイベントの分類
ad.add(dom.addDisposableListener(this.raw.element, dom.EventType.MOUSE_WHEEL, (e: IMouseWheelEvent) => {
    const classifier = MouseWheelClassifier.INSTANCE;
    classifier.acceptStandardWheelEvent(new StandardWheelEvent(e));
    const value = classifier.isPhysicalMouseWheel();
    if (value !== this._isPhysicalMouseWheel) {
        this._isPhysicalMouseWheel = value;
        this._updateSmoothScrolling();
    }
}, { passive: true }));
```

**重要なポイント**:
- トラックパッド使用時はスムーススクロールを無効化（0ms）
- 物理マウスホイール使用時は125msのスムーススクロール
- `passive: true`でイベントリスナーのパフォーマンス最適化

### 1.2 レンダラーの選択とGPUアクセラレーション

VS Codeは自動的に最適なレンダラーを選択し、問題が発生した場合はフォールバックします。

```typescript
private static _suggestedRendererType: 'dom' | undefined = undefined;

private _shouldLoadWebgl(): boolean {
    return (
        this._terminalConfigurationService.config.gpuAcceleration === 'auto' &&
        XtermTerminal._suggestedRendererType === undefined
    ) || this._terminalConfigurationService.config.gpuAcceleration === 'on';
}

private async _enableWebglRenderer(): Promise<void> {
    if (!this.raw.element || this._webglAddon) {
        return;
    }

    const Addon = await this._xtermAddonLoader.importAddon('webgl');
    this._webglAddon = new Addon();

    try {
        this.raw.loadAddon(this._webglAddon);
        this._logService.trace('Webgl was loaded');

        // コンテキストロストの処理
        this._webglAddon.onContextLoss(() => {
            this._logService.info(`Webgl lost context, disposing of webgl renderer`);
            this._disposeOfWebglRenderer();
        });

        this._refreshImageAddon();

        // WebGLレンダラーのセル寸法が異なるため、再リサイズ
        this._onDidRequestRefreshDimensions.fire();

    } catch (e) {
        this._logService.warn(`Webgl could not be loaded. Falling back to the DOM renderer`, e);
        XtermTerminal._suggestedRendererType = 'dom';
        this._disposeOfWebglRenderer();
    }
}

private _disposeOfWebglRenderer(): void {
    try {
        this._webglAddon?.dispose();
    } catch {
        // ignore
    }
    this._webglAddon = undefined;
    this._refreshImageAddon();

    // DOM レンダラーへの切り替え後、再リサイズ
    this._onDidRequestRefreshDimensions.fire();
}
```

**重要なポイント**:
- WebGLが失敗した場合、自動的にDOMレンダラーにフォールバック
- WebGLコンテキストロストを監視して自動復旧
- レンダラー切り替え時は必ず寸法を再計算

### 1.3 バッファリング戦略

VS Codeは出力データを効率的に処理するため、xterm.jsの内部バッファリングに依存します。

```typescript
write(data: string | Uint8Array, callback?: () => void): void {
    this.raw.write(data, callback);
}

// 強制的な再描画
forceRefresh() {
    this._core.viewport?._innerRefresh();
}

forceRedraw() {
    this.raw.clearTextureAtlas();  // WebGL テクスチャアトラスをクリア
}
```

**実装パターン**:
- xterm.jsの`write()`は内部で自動的にバッファリング
- 必要に応じて`forceRefresh()`で強制再描画
- WebGL使用時は`clearTextureAtlas()`でテクスチャを再生成

---

## 2. スクロールバック管理

### 2.1 スクロールバック設定

```typescript
// xtermの初期化時にスクロールバック設定
this.raw = this._register(new xtermCtor({
    allowProposedApi: true,
    cols: options.cols,
    rows: options.rows,
    scrollback: config.scrollback,  // デフォルト: 1000行
    // ... その他の設定
}));

// 動的なスクロールバック更新
updateConfig(): void {
    const config = this._terminalConfigurationService.config;
    this.raw.options.scrollback = config.scrollback;
    // ... その他の設定更新
}
```

### 2.2 バッファからのテキスト取得

VS Codeはラップされた行を正しく処理するヘルパー関数を実装しています。

```typescript
// 完全な行を取得（ラップされた行を結合）
function getFullBufferLineAsString(lineIndex: number, buffer: IBuffer): { lineData: string | undefined; lineIndex: number } {
    let line = buffer.getLine(lineIndex);
    if (!line) {
        return { lineData: undefined, lineIndex };
    }

    let lineData = line.translateToString(true);

    // ラップされた行を遡って結合
    while (lineIndex > 0 && line.isWrapped) {
        line = buffer.getLine(--lineIndex);
        if (!line) {
            break;
        }
        lineData = line.translateToString(false) + lineData;
    }

    return { lineData, lineIndex };
}

// バッファの逆イテレーション（最新行から古い行へ）
*getBufferReverseIterator(): IterableIterator<string> {
    for (let i = this.raw.buffer.active.length - 1; i >= 0; i--) {
        const { lineData, lineIndex } = getFullBufferLineAsString(i, this.raw.buffer.active);
        if (lineData) {
            i = lineIndex;  // ラップされた行をスキップ
            yield lineData;
        }
    }
}
```

**重要なポイント**:
- `line.isWrapped`でラップされた行を検出
- ラップされた行は結合して完全な行として返す
- 逆イテレーターで効率的にバッファを走査

### 2.3 指定範囲のコンテンツ取得

```typescript
getContentsAsText(startMarker?: IXtermMarker, endMarker?: IXtermMarker): string {
    const lines: string[] = [];
    const buffer = this.raw.buffer.active;

    // マーカーの有効性チェック
    if (startMarker?.line === -1) {
        throw new Error('Cannot get contents of a disposed startMarker');
    }
    if (endMarker?.line === -1) {
        throw new Error('Cannot get contents of a disposed endMarker');
    }

    const startLine = startMarker?.line ?? 0;
    const endLine = endMarker?.line ?? buffer.length - 1;

    for (let y = startLine; y <= endLine; y++) {
        lines.push(buffer.getLine(y)?.translateToString(true) ?? '');
    }

    return lines.join('\n');
}
```

### 2.4 ラップされた行のカウント

```typescript
private _getWrappedLineCount(index: number, buffer: IBuffer): { lineCount: number; currentIndex: number; endSpaces: number } {
    let line = buffer.getLine(index);
    if (!line) {
        throw new Error('Could not get line');
    }

    let currentIndex = index;
    let endSpaces = 0;

    // 行末の空白文字をカウント
    for (let i = Math.min(line.length, this.raw.cols) - 1; i >= 0; i--) {
        if (!line?.getCell(i)?.getChars()) {
            endSpaces++;
        } else {
            break;
        }
    }

    // ラップされた行の開始位置まで遡る
    while (line?.isWrapped && currentIndex > 0) {
        currentIndex--;
        line = buffer.getLine(currentIndex);
    }

    return { lineCount: index - currentIndex + 1, currentIndex, endSpaces };
}

// ビューポート内の最長ラップ行を取得
getLongestViewportWrappedLineLength(): number {
    let maxLineLength = 0;
    for (let i = this.raw.buffer.active.length - 1; i >= this.raw.buffer.active.viewportY; i--) {
        const lineInfo = this._getWrappedLineCount(i, this.raw.buffer.active);
        maxLineLength = Math.max(maxLineLength, ((lineInfo.lineCount * this.raw.cols) - lineInfo.endSpaces) || 0);
        i = lineInfo.currentIndex;
    }
    return maxLineLength;
}
```

---

## 3. xterm.js アドオン統合

### 3.1 SerializeAddon による HTML シリアライゼーション

VS Codeは`SerializeAddon`を遅延ロードして、ANSIカラーを保持したままHTMLとしてエクスポートします。

```typescript
private _serializeAddon?: SerializeAddonType;

async getContentsAsHtml(): Promise<string> {
    if (!this._serializeAddon) {
        const Addon = await this._xtermAddonLoader.importAddon('serialize');
        this._serializeAddon = new Addon();
        this.raw.loadAddon(this._serializeAddon);
    }

    return this._serializeAddon.serializeAsHTML();
}

async getCommandOutputAsHtml(command: ITerminalCommand, maxLines: number): Promise<{ text: string; truncated?: boolean }> {
    if (!this._serializeAddon) {
        const Addon = await this._xtermAddonLoader.importAddon('serialize');
        this._serializeAddon = new Addon();
        this.raw.loadAddon(this._serializeAddon);
    }

    let startLine: number;
    let startCol: number;

    // コマンドの実行マーカーから開始位置を決定
    if (command.executedMarker && command.executedMarker.line >= 0) {
        startLine = command.executedMarker.line;
        startCol = Math.max(command.executedX ?? 0, 0);
    } else {
        startLine = command.marker?.line !== undefined ? command.marker.line + 1 : 1;
        startCol = Math.max(command.startX ?? 0, 0);
    }

    let endLine = command.endMarker?.line !== undefined ? command.endMarker.line - 1 : this.raw.buffer.active.length - 1;

    if (endLine < startLine) {
        return { text: '', truncated: false };
    }

    // 末尾の空行をトリム
    let emptyLinesFromEnd = 0;
    for (let i = endLine; i >= startLine; i--) {
        const line = this.raw.buffer.active.getLine(i);
        if (line && line.translateToString(true).trim() === '') {
            emptyLinesFromEnd++;
        } else {
            break;
        }
    }
    endLine = endLine - emptyLinesFromEnd;

    // 先頭の空行をトリム
    let emptyLinesFromStart = 0;
    for (let i = startLine; i <= endLine; i++) {
        const line = this.raw.buffer.active.getLine(i);
        if (line && line.translateToString(true, i === startLine ? startCol : undefined).trim() === '') {
            if (i === startLine) {
                startCol = 0;
            }
            emptyLinesFromStart++;
        } else {
            break;
        }
    }
    startLine = startLine + emptyLinesFromStart;

    // 最大行数制限
    if (maxLines && endLine - startLine > maxLines) {
        startLine = endLine - maxLines;
        startCol = 0;
    }

    const bufferLine = this.raw.buffer.active.getLine(startLine);
    if (bufferLine) {
        startCol = Math.min(startCol, bufferLine.length);
    }

    const range = { startLine, endLine, startCol };
    const result = this._serializeAddon.serializeAsHTML({ range });

    return { text: result, truncated: (endLine - startLine) >= maxLines };
}

async getSelectionAsHtml(command?: ITerminalCommand): Promise<string> {
    if (!this._serializeAddon) {
        const Addon = await this._xtermAddonLoader.importAddon('serialize');
        this._serializeAddon = new Addon();
        this.raw.loadAddon(this._serializeAddon);
    }

    if (command) {
        const length = command.getOutput()?.length;
        const row = command.marker?.line;
        if (!length || !row) {
            throw new Error(`No row ${row} or output length ${length} for command ${command}`);
        }
        this.raw.select(0, row + 1, length - Math.floor(length / this.raw.cols));
    }

    const result = this._serializeAddon.serializeAsHTML({ onlySelection: true });

    if (command) {
        this.raw.clearSelection();
    }

    return result;
}
```

**重要なポイント**:
- SerializeAddonは遅延ロード（使用時のみインポート）
- 空行のトリミングで無駄なデータを削減
- 範囲指定でパフォーマンスを最適化

### 3.2 その他のアドオン

```typescript
// 必須アドオン（常にロード）
private _markNavigationAddon: MarkNavigationAddon;
private _shellIntegrationAddon: ShellIntegrationAddon;
private _decorationAddon: DecorationAddon;

// オプションアドオン（遅延ロード）
private _searchAddon?: SearchAddonType;
private _unicode11Addon?: Unicode11AddonType;
private _webglAddon?: WebglAddonType;
private _serializeAddon?: SerializeAddonType;
private _imageAddon?: ImageAddonType;
private _clipboardAddon?: ClipboardAddonType;

// アドオンの初期化例
this._xtermAddonLoader.importAddon('clipboard').then(ClipboardAddon => {
    if (this._store.isDisposed) {
        return;
    }
    this._clipboardAddon = this._instantiationService.createInstance(ClipboardAddon, undefined, {
        async readText(type: ClipboardSelectionType): Promise<string> {
            return _clipboardService.readText(type === 'p' ? 'selection' : 'clipboard');
        },
        async writeText(type: ClipboardSelectionType, text: string): Promise<void> {
            return _clipboardService.writeText(text, type === 'p' ? 'selection' : 'clipboard');
        }
    });
    this.raw.loadAddon(this._clipboardAddon);
});
```

---

## 4. ターミナルライフサイクル管理

### 4.1 アタッチメントとデタッチメント

```typescript
private _attached?: { container: HTMLElement; options: IXtermAttachToElementOptions };

attachToElement(container: HTMLElement, partialOptions?: Partial<IXtermAttachToElementOptions>): HTMLElement {
    const options: IXtermAttachToElementOptions = { enableGpu: true, ...partialOptions };

    if (!this._attached) {
        this.raw.open(container);
    }

    // GPU アクセラレーションの有効化
    if (options.enableGpu) {
        if (this._shouldLoadWebgl()) {
            this._enableWebglRenderer();
        }
    }

    if (!this.raw.element || !this.raw.textarea) {
        throw new Error('xterm elements not set after open');
    }

    const ad = this._attachedDisposables;
    ad.clear();

    // フォーカスイベントのリスナー
    ad.add(dom.addDisposableListener(this.raw.textarea, 'focus', () => this._setFocused(true)));
    ad.add(dom.addDisposableListener(this.raw.textarea, 'blur', () => this._setFocused(false)));
    ad.add(dom.addDisposableListener(this.raw.textarea, 'focusout', () => this._setFocused(false)));

    // マウスホイール分類器の追跡
    ad.add(dom.addDisposableListener(this.raw.element, dom.EventType.MOUSE_WHEEL, (e: IMouseWheelEvent) => {
        const classifier = MouseWheelClassifier.INSTANCE;
        classifier.acceptStandardWheelEvent(new StandardWheelEvent(e));
        const value = classifier.isPhysicalMouseWheel();
        if (value !== this._isPhysicalMouseWheel) {
            this._isPhysicalMouseWheel = value;
            this._updateSmoothScrolling();
        }
    }, { passive: true }));

    this._refreshLigaturesAddon();

    this._attached = { container, options };

    return this._attached?.container.querySelector('.xterm-screen')!;
}

private _setFocused(isFocused: boolean) {
    this._onDidChangeFocus.fire(isFocused);
    this._anyTerminalFocusContextKey.set(isFocused);
    this._anyFocusedTerminalHasSelection.set(isFocused && this.raw.hasSelection());
}
```

### 4.2 リサイズ処理

```typescript
resize(columns: number, rows: number): void {
    this._logService.debug('resizing', columns, rows);
    this.raw.resize(columns, rows);
}

// スケーリングを考慮した寸法計算
export function getXtermScaledDimensions(w: Window, font: ITerminalFont, width: number, height: number): { rows: number; cols: number } | null {
    if (!font.charWidth || !font.charHeight) {
        return null;
    }

    // CSS ピクセルから実際のピクセルへの変換
    const scaledWidthAvailable = width * w.devicePixelRatio;
    const scaledCharWidth = font.charWidth * w.devicePixelRatio + font.letterSpacing;
    const cols = Math.max(Math.floor(scaledWidthAvailable / scaledCharWidth), 1);

    const scaledHeightAvailable = height * w.devicePixelRatio;
    const scaledCharHeight = Math.ceil(font.charHeight * w.devicePixelRatio);
    const scaledLineHeight = Math.floor(scaledCharHeight * font.lineHeight);
    const rows = Math.max(Math.floor(scaledHeightAvailable / scaledLineHeight), 1);

    return { rows, cols };
}
```

**重要なポイント**:
- `devicePixelRatio`を使用して正確なピクセル計算
- 最小値は1行1列を保証

### 4.3 Dispose パターン

```typescript
override dispose(): void {
    this._anyTerminalFocusContextKey.reset();
    this._anyFocusedTerminalHasSelection.reset();
    this._onDidDispose.fire();
    super.dispose();
}
```

---

## 5. 実装への適用

### 5.1 このプロジェクトへの統合

現在のプロジェクトに適用すべき重要なパターン：

#### パターン1: デバイス別スムーススクロール制御

```typescript
// TerminalLifecycleManager.ts に追加
private _isPhysicalMouseWheel = true;
private readonly SMOOTH_SCROLL_DURATION = 125;

private _setupSmoothScrolling(terminal: Terminal): void {
    const element = terminal.element;
    if (!element) return;

    // マウスホイールイベントの監視
    element.addEventListener('wheel', (e: WheelEvent) => {
        // トラックパッド vs マウスホイールの検出
        // deltaMode: 0 = ピクセル（トラックパッド）, 1 = 行（マウス）
        const isPhysical = e.deltaMode === 1;

        if (isPhysical !== this._isPhysicalMouseWheel) {
            this._isPhysicalMouseWheel = isPhysical;
            this._updateSmoothScrolling(terminal);
        }
    }, { passive: true });
}

private _updateSmoothScrolling(terminal: Terminal): void {
    // xterm.jsにはsmoothScrollDurationオプションがあるが、
    // このプロジェクトでは必要に応じてカスタム実装を検討
}
```

#### パターン2: バッファからの完全な行取得

```typescript
// StandardTerminalPersistenceManager.ts に追加
private _getFullBufferLine(lineIndex: number, buffer: IBuffer): string | undefined {
    let line = buffer.getLine(lineIndex);
    if (!line) {
        return undefined;
    }

    let lineData = line.translateToString(true);
    let currentIndex = lineIndex;

    // ラップされた行を遡って結合
    while (currentIndex > 0 && line.isWrapped) {
        line = buffer.getLine(--currentIndex);
        if (!line) {
            break;
        }
        lineData = line.translateToString(false) + lineData;
    }

    return lineData;
}

private async _saveTerminalScrollback(terminalId: number): Promise<void> {
    const terminal = this._getTerminal(terminalId);
    if (!terminal) return;

    const lines: string[] = [];
    const buffer = terminal.buffer.active;
    const maxLines = this.PERSISTENT_SESSION_SCROLLBACK;

    // バッファの末尾から最大行数分を取得
    const startLine = Math.max(0, buffer.length - maxLines);

    for (let i = startLine; i < buffer.length; i++) {
        const lineData = this._getFullBufferLine(i, buffer);
        if (lineData !== undefined) {
            lines.push(lineData);
        }
    }

    // ストレージに保存
    await this._storageManager.saveScrollback(terminalId, lines);
}
```

#### パターン3: SerializeAddon の統合

```typescript
// TerminalLifecycleManager.ts に追加
import { SerializeAddon } from '@xterm/addon-serialize';

private _serializeAddons: Map<number, SerializeAddon> = new Map();

public async getTerminalContentAsHtml(terminalId: number): Promise<string> {
    const terminal = this._getTerminal(terminalId);
    if (!terminal) {
        throw new Error(`Terminal ${terminalId} not found`);
    }

    let serializeAddon = this._serializeAddons.get(terminalId);

    if (!serializeAddon) {
        serializeAddon = new SerializeAddon();
        terminal.loadAddon(serializeAddon);
        this._serializeAddons.set(terminalId, serializeAddon);
    }

    return serializeAddon.serializeAsHTML();
}

public async getTerminalRangeAsHtml(
    terminalId: number,
    startLine: number,
    endLine: number
): Promise<string> {
    const terminal = this._getTerminal(terminalId);
    if (!terminal) {
        throw new Error(`Terminal ${terminalId} not found`);
    }

    let serializeAddon = this._serializeAddons.get(terminalId);

    if (!serializeAddon) {
        serializeAddon = new SerializeAddon();
        terminal.loadAddon(serializeAddon);
        this._serializeAddons.set(terminalId, serializeAddon);
    }

    // 空行をトリミング
    const buffer = terminal.buffer.active;
    let trimmedEndLine = endLine;

    for (let i = endLine; i >= startLine; i--) {
        const line = buffer.getLine(i);
        if (line && line.translateToString(true).trim() === '') {
            trimmedEndLine--;
        } else {
            break;
        }
    }

    const range = {
        startLine,
        endLine: trimmedEndLine,
        startCol: 0
    };

    return serializeAddon.serializeAsHTML({ range });
}

// Dispose時のクリーンアップ
private _disposeTerminal(terminalId: number): void {
    const serializeAddon = this._serializeAddons.get(terminalId);
    if (serializeAddon) {
        serializeAddon.dispose();
        this._serializeAddons.delete(terminalId);
    }

    // ... 既存のdispose処理
}
```

#### パターン4: リサイズ計算の最適化

```typescript
// TerminalLifecycleManager.ts に追加
private _calculateOptimalDimensions(
    containerWidth: number,
    containerHeight: number,
    fontSize: number,
    lineHeight: number,
    letterSpacing: number
): { cols: number; rows: number } {
    // フォント寸法の測定
    const measureElement = document.createElement('div');
    measureElement.style.position = 'absolute';
    measureElement.style.visibility = 'hidden';
    measureElement.style.fontFamily = 'monospace';
    measureElement.style.fontSize = `${fontSize}px`;
    measureElement.textContent = 'X';
    document.body.appendChild(measureElement);

    const charWidth = measureElement.getBoundingClientRect().width;
    const charHeight = measureElement.getBoundingClientRect().height;

    document.body.removeChild(measureElement);

    // devicePixelRatio を考慮した計算
    const dpr = window.devicePixelRatio || 1;
    const scaledWidthAvailable = containerWidth * dpr;
    const scaledCharWidth = charWidth * dpr + letterSpacing;
    const cols = Math.max(Math.floor(scaledWidthAvailable / scaledCharWidth), 1);

    const scaledHeightAvailable = containerHeight * dpr;
    const scaledCharHeight = Math.ceil(charHeight * dpr);
    const scaledLineHeight = Math.floor(scaledCharHeight * lineHeight);
    const rows = Math.max(Math.floor(scaledHeightAvailable / scaledLineHeight), 1);

    return { cols, rows };
}
```

### 5.2 パフォーマンス最適化チェックリスト

VS Codeのパターンに基づいた最適化項目：

- [x] スムーススクロールのデバイス別制御
- [x] WebGL レンダラーの遅延ロードとフォールバック
- [x] アドオンの遅延ロード（必要時のみインポート）
- [x] イベントリスナーに `passive: true` を使用
- [x] ラップされた行の正しい処理
- [ ] SerializeAddon の統合（HTMLエクスポート機能）
- [ ] バッファの効率的なイテレーション
- [ ] devicePixelRatio を考慮したリサイズ計算

### 5.3 次のステップ

1. **SerializeAddon の実装**: ANSIカラーを保持したHTMLエクスポート機能
2. **スムーススクロール最適化**: トラックパッドとマウスの自動検出
3. **バッファ管理の改善**: ラップされた行の正しい処理
4. **パフォーマンス測定**: VS Codeと同等のレンダリング性能を達成

---

## 6. まとめ

VS Codeのターミナル実装から学んだ重要なパターン：

1. **レンダリング最適化**
   - デバイス別のスムーススクロール制御
   - WebGL レンダラーの自動フォールバック
   - 強制再描画メカニズム

2. **スクロールバック管理**
   - ラップされた行の正しい処理
   - 効率的なバッファイテレーション
   - 範囲指定によるパフォーマンス最適化

3. **xterm.js アドオン**
   - 遅延ロードパターン
   - SerializeAddon によるHTML生成
   - アドオンのライフサイクル管理

4. **ライフサイクル管理**
   - アタッチメント/デタッチメントパターン
   - devicePixelRatio を考慮したリサイズ
   - 適切なDispose処理

これらのパターンを適用することで、VS Codeと同等の高性能なターミナル実装が実現できます。
