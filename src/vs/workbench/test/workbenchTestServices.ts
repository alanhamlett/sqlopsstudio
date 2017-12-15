/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/workbench/parts/files/browser/files.contribution'; // load our contribution into the test
import { FileEditorInput } from 'vs/workbench/parts/files/common/editors/fileEditorInput';
import { Promise, TPromise } from 'vs/base/common/winjs.base';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { EventEmitter } from 'vs/base/common/eventEmitter';
import * as paths from 'vs/base/common/paths';
import URI from 'vs/base/common/uri';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { StorageService, InMemoryLocalStorage } from 'vs/platform/storage/common/storageService';
import { IEditorGroup, ConfirmResult, IEditorOpeningEvent } from 'vs/workbench/common/editor';
import Event, { Emitter } from 'vs/base/common/event';
import Severity from 'vs/base/common/severity';
import { IBackupFileService } from 'vs/workbench/services/backup/common/backup';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { IPartService, Parts } from 'vs/workbench/services/part/common/partService';
import { TextModelResolverService } from 'vs/workbench/services/textmodelResolver/common/textModelResolverService';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { IEditorInput, IEditorOptions, Position, Direction, IEditor, IResourceInput } from 'vs/platform/editor/common/editor';
import { IUntitledEditorService, UntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IMessageService, IConfirmation, IConfirmationResult, IChoiceService } from 'vs/platform/message/common/message';
import { IWorkspaceContextService, IWorkspace as IWorkbenchWorkspace, WorkbenchState, IWorkspaceFolder, IWorkspaceFoldersChangeEvent } from 'vs/platform/workspace/common/workspace';
import { ILifecycleService, ShutdownEvent, ShutdownReason, StartupKind, LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { EditorStacksModel } from 'vs/workbench/common/editor/editorStacksModel';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { IEditorGroupService, GroupArrangement, GroupOrientation, IEditorTabOptions, IMoveOptions } from 'vs/workbench/services/group/common/groupService';
import { TextFileService } from 'vs/workbench/services/textfile/common/textFileService';
import { FileOperationEvent, IFileService, IResolveContentOptions, FileOperationError, IFileStat, IResolveFileResult, IImportResult, FileChangesEvent, IResolveFileOptions, IContent, IUpdateContentOptions, IStreamContent, ICreateFileOptions } from 'vs/platform/files/common/files';
import { IModelService } from 'vs/editor/common/services/modelService';
import { ModeServiceImpl } from 'vs/editor/common/services/modeServiceImpl';
import { ModelServiceImpl } from 'vs/editor/common/services/modelServiceImpl';
import { IRawTextContent, ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { parseArgs } from 'vs/platform/environment/node/argv';
import { EnvironmentService } from 'vs/platform/environment/node/environmentService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IHistoryService } from 'vs/workbench/services/history/common/history';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IWindowsService, IWindowService, INativeOpenDialogOptions, IEnterWorkspaceResult, IMessageBoxResult } from 'vs/platform/windows/common/windows';
import { TestWorkspace } from 'vs/platform/workspace/test/common/testWorkspace';
import { RawTextSource, IRawTextSource } from 'vs/editor/common/model/textSource';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { isLinux } from 'vs/base/common/platform';
import { generateUuid } from 'vs/base/common/uuid';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { IWorkspaceIdentifier, ISingleFolderWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier, IWorkspaceFolderCreationData } from 'vs/platform/workspaces/common/workspaces';
import { IRecentlyOpened } from 'vs/platform/history/common/history';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/resourceConfiguration';
import { IPosition } from 'vs/editor/common/core/position';
import { ICommandAction } from 'vs/platform/actions/common/actions';
import { IHashService } from 'vs/workbench/services/hash/common/hashService';

export function createFileInput(instantiationService: IInstantiationService, resource: URI): FileEditorInput {
	return instantiationService.createInstance(FileEditorInput, resource, void 0);
}

export const TestEnvironmentService = new EnvironmentService(parseArgs(process.argv), process.execPath);

export class TestContextService implements IWorkspaceContextService {
	public _serviceBrand: any;

	private workspace: IWorkbenchWorkspace;
	private id: string;
	private options: any;

	private _onDidChangeWorkspaceName: Emitter<void>;
	private _onDidChangeWorkspaceFolders: Emitter<IWorkspaceFoldersChangeEvent>;
	private _onDidChangeWorkbenchState: Emitter<WorkbenchState>;

	constructor(workspace: any = TestWorkspace, options: any = null) {
		this.workspace = workspace;
		this.id = generateUuid();
		this.options = options || Object.create(null);
		this._onDidChangeWorkspaceFolders = new Emitter<IWorkspaceFoldersChangeEvent>();
		this._onDidChangeWorkbenchState = new Emitter<WorkbenchState>();
	}

	public get onDidChangeWorkspaceName(): Event<void> {
		return this._onDidChangeWorkspaceName.event;
	}

	public get onDidChangeWorkspaceFolders(): Event<IWorkspaceFoldersChangeEvent> {
		return this._onDidChangeWorkspaceFolders.event;
	}

	public get onDidChangeWorkbenchState(): Event<WorkbenchState> {
		return this._onDidChangeWorkbenchState.event;
	}

	public getFolders(): IWorkspaceFolder[] {
		return this.workspace ? this.workspace.folders : [];
	}

	public getWorkbenchState(): WorkbenchState {
		if (this.workspace.configuration) {
			return WorkbenchState.WORKSPACE;
		}

		if (this.workspace.folders.length) {
			return WorkbenchState.FOLDER;
		}

		return WorkbenchState.EMPTY;
	}

	public getWorkspace(): IWorkbenchWorkspace {
		return this.workspace;
	}

	public getWorkspaceFolder(resource: URI): IWorkspaceFolder {
		return this.isInsideWorkspace(resource) ? this.workspace.folders[0] : null;
	}

	public setWorkspace(workspace: any): void {
		this.workspace = workspace;
	}

	public getOptions() {
		return this.options;
	}

	public updateOptions() {

	}

	public isInsideWorkspace(resource: URI): boolean {
		if (resource && this.workspace) {
			return paths.isEqualOrParent(resource.fsPath, this.workspace.folders[0].uri.fsPath, !isLinux /* ignorecase */);
		}

		return false;
	}

	public toResource(workspaceRelativePath: string): URI {
		return URI.file(paths.join('C:\\', workspaceRelativePath));
	}

	public isCurrentWorkspace(workspaceIdentifier: ISingleFolderWorkspaceIdentifier | IWorkspaceIdentifier): boolean {
		return isSingleFolderWorkspaceIdentifier(workspaceIdentifier) && this.pathEquals(this.workspace.folders[0].uri.fsPath, workspaceIdentifier);
	}

	private pathEquals(path1: string, path2: string): boolean {
		if (!isLinux) {
			path1 = path1.toLowerCase();
			path2 = path2.toLowerCase();
		}

		return path1 === path2;
	}
}

export class TestTextFileService extends TextFileService {
	public cleanupBackupsBeforeShutdownCalled: boolean;

	private promptPath: string;
	private confirmResult: ConfirmResult;
	private resolveTextContentError: FileOperationError;

	constructor(
		@ILifecycleService lifecycleService: ILifecycleService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IConfigurationService configurationService: IConfigurationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchEditorService editorService: IWorkbenchEditorService,
		@IFileService fileService: IFileService,
		@IUntitledEditorService untitledEditorService: IUntitledEditorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IMessageService messageService: IMessageService,
		@IBackupFileService backupFileService: IBackupFileService,
		@IWindowsService windowsService: IWindowsService,
		@IHistoryService historyService: IHistoryService
	) {
		super(lifecycleService, contextService, configurationService, telemetryService, fileService, untitledEditorService, instantiationService, messageService, TestEnvironmentService, backupFileService, windowsService, historyService);
	}

	public setPromptPath(path: string): void {
		this.promptPath = path;
	}

	public setConfirmResult(result: ConfirmResult): void {
		this.confirmResult = result;
	}

	public setResolveTextContentErrorOnce(error: FileOperationError): void {
		this.resolveTextContentError = error;
	}

	public resolveTextContent(resource: URI, options?: IResolveContentOptions): TPromise<IRawTextContent> {
		if (this.resolveTextContentError) {
			const error = this.resolveTextContentError;
			this.resolveTextContentError = null;

			return TPromise.wrapError<IRawTextContent>(error);
		}

		return this.fileService.resolveContent(resource, options).then((content) => {
			const textSource = RawTextSource.fromString(content.value);
			return <IRawTextContent>{
				resource: content.resource,
				name: content.name,
				mtime: content.mtime,
				etag: content.etag,
				encoding: content.encoding,
				value: textSource,
				valueLogicalHash: null
			};
		});
	}

	public promptForPath(defaultPath?: string): string {
		return this.promptPath;
	}

	public confirmSave(resources?: URI[]): ConfirmResult {
		return this.confirmResult;
	}

	public onFilesConfigurationChange(configuration: any): void {
		super.onFilesConfigurationChange(configuration);
	}

	protected cleanupBackupsBeforeShutdown(): TPromise<void> {
		this.cleanupBackupsBeforeShutdownCalled = true;
		return TPromise.as(void 0);
	}
}

export function workbenchInstantiationService(): IInstantiationService {
	let instantiationService = new TestInstantiationService(new ServiceCollection([ILifecycleService, new TestLifecycleService()]));
	instantiationService.stub(IWorkspaceContextService, new TestContextService(TestWorkspace));
	const configService = new TestConfigurationService();
	instantiationService.stub(IConfigurationService, configService);
	instantiationService.stub(ITextResourceConfigurationService, new TestTextResourceConfigurationService(configService));
	instantiationService.stub(IUntitledEditorService, instantiationService.createInstance(UntitledEditorService));
	instantiationService.stub(IStorageService, new TestStorageService());
	instantiationService.stub(IWorkbenchEditorService, new TestEditorService());
	instantiationService.stub(IPartService, new TestPartService());
	instantiationService.stub(IEditorGroupService, new TestEditorGroupService());
	instantiationService.stub(IModeService, ModeServiceImpl);
	instantiationService.stub(IHistoryService, new TestHistoryService());
	instantiationService.stub(IModelService, instantiationService.createInstance(ModelServiceImpl));
	instantiationService.stub(IFileService, new TestFileService());
	instantiationService.stub(IBackupFileService, new TestBackupFileService());
	instantiationService.stub(ITelemetryService, NullTelemetryService);
	instantiationService.stub(IMessageService, new TestMessageService());
	instantiationService.stub(IUntitledEditorService, instantiationService.createInstance(UntitledEditorService));
	instantiationService.stub(IWindowsService, new TestWindowsService());
	instantiationService.stub(ITextFileService, <ITextFileService>instantiationService.createInstance(TestTextFileService));
	instantiationService.stub(ITextModelService, <ITextModelService>instantiationService.createInstance(TextModelResolverService));
	instantiationService.stub(IEnvironmentService, TestEnvironmentService);
	instantiationService.stub(IThemeService, new TestThemeService());
	instantiationService.stub(IHashService, new TestHashService());
	instantiationService.stub(IChoiceService, {
		choose: (severity, message, options, cancelId): TPromise<number> => {
			return TPromise.as(cancelId);
		}
	});

	return instantiationService;
}

export class TestHistoryService implements IHistoryService {

	public _serviceBrand: any;

	constructor(private root?: URI) {
	}

	public reopenLastClosedEditor(): void {
	}

	public forward(acrossEditors?: boolean): void {
	}

	public back(acrossEditors?: boolean): void {
	}

	public last(): void {
	}

	public remove(input: IEditorInput | IResourceInput): void {
	}

	public clear(): void {
	}

	public getHistory(): (IEditorInput | IResourceInput)[] {
		return [];
	}

	public getLastActiveWorkspaceRoot(schemeFilter?: string): URI {
		return this.root;
	}

	public getLastActiveFile(): URI {
		return void 0;
	}
}

export class TestMessageService implements IMessageService {

	public _serviceBrand: any;

	private counter: number;

	constructor() {
		this.counter = 0;
	}

	public show(sev: Severity, message: any): () => void {
		this.counter++;

		return null;
	}

	public getCounter() {
		return this.counter;
	}

	public hideAll(): void {
		// No-op
	}

	public confirmSync(confirmation: IConfirmation): boolean {
		return false;
	}

	public confirm(confirmation: IConfirmation): Promise<IConfirmationResult> {
		return TPromise.as({ confirmed: false });
	}
}

export class TestPartService implements IPartService {

	public _serviceBrand: any;

	private _onTitleBarVisibilityChange = new Emitter<void>();
	private _onEditorLayout = new Emitter<void>();

	public get onTitleBarVisibilityChange(): Event<void> {
		return this._onTitleBarVisibilityChange.event;
	}

	public get onEditorLayout(): Event<void> {
		return this._onEditorLayout.event;
	}

	public layout(): void { }

	public isCreated(): boolean {
		return true;
	}

	public joinCreation(): Promise {
		return TPromise.as(null);
	}

	public hasFocus(part): boolean {
		return false;
	}

	public isVisible(part): boolean {
		return true;
	}

	public getContainer(part): HTMLElement {
		return null;
	}

	public isTitleBarHidden(): boolean {
		return false;
	}

	public getTitleBarOffset(): number {
		return 0;
	}

	public isStatusBarHidden(): boolean {
		return false;
	}

	public isActivityBarHidden(): boolean {
		return false;
	}

	public setActivityBarHidden(hidden: boolean): void { }

	public isSideBarHidden(): boolean {
		return false;
	}

	public setSideBarHidden(hidden: boolean): TPromise<void> { return TPromise.as(null); }

	public isPanelHidden(): boolean {
		return false;
	}

	public setPanelHidden(hidden: boolean): TPromise<void> { return TPromise.as(null); }

	public toggleMaximizedPanel(): void { }

	public isPanelMaximized(): boolean {
		return false;
	}

	public getSideBarPosition() {
		return 0;
	}

	public getPanelPosition() {
		return 0;
	}

	public addClass(clazz: string): void { }
	public removeClass(clazz: string): void { }
	public getWorkbenchElementId(): string { return ''; }

	public toggleZenMode(): void { }

	public resizePart(part: Parts, sizeChange: number): void { }
}

export class TestStorageService extends EventEmitter implements IStorageService {
	public _serviceBrand: any;

	private storage: StorageService;

	constructor() {
		super();

		let context = new TestContextService();
		this.storage = new StorageService(new InMemoryLocalStorage(), null, context.getWorkspace().id);
	}

	store(key: string, value: any, scope: StorageScope = StorageScope.GLOBAL): void {
		this.storage.store(key, value, scope);
	}

	remove(key: string, scope: StorageScope = StorageScope.GLOBAL): void {
		this.storage.remove(key, scope);
	}

	get(key: string, scope: StorageScope = StorageScope.GLOBAL, defaultValue?: string): string {
		return this.storage.get(key, scope, defaultValue);
	}

	getInteger(key: string, scope: StorageScope = StorageScope.GLOBAL, defaultValue?: number): number {
		return this.storage.getInteger(key, scope, defaultValue);
	}

	getBoolean(key: string, scope: StorageScope = StorageScope.GLOBAL, defaultValue?: boolean): boolean {
		return this.storage.getBoolean(key, scope, defaultValue);
	}
}

export class TestEditorGroupService implements IEditorGroupService {
	public _serviceBrand: any;

	private stacksModel: EditorStacksModel;

	private _onEditorsChanged: Emitter<void>;
	private _onEditorOpening: Emitter<IEditorOpeningEvent>;
	private _onEditorOpenFail: Emitter<IEditorInput>;
	private _onEditorsMoved: Emitter<void>;
	private _onGroupOrientationChanged: Emitter<void>;
	private _onTabOptionsChanged: Emitter<IEditorTabOptions>;

	constructor(callback?: (method: string) => void) {
		this._onEditorsMoved = new Emitter<void>();
		this._onEditorsChanged = new Emitter<void>();
		this._onEditorOpening = new Emitter<IEditorOpeningEvent>();
		this._onGroupOrientationChanged = new Emitter<void>();
		this._onEditorOpenFail = new Emitter<IEditorInput>();
		this._onTabOptionsChanged = new Emitter<IEditorTabOptions>();

		let services = new ServiceCollection();

		services.set(IStorageService, new TestStorageService());
		services.set(IConfigurationService, new TestConfigurationService());
		services.set(IWorkspaceContextService, new TestContextService());
		const lifecycle = new TestLifecycleService();
		services.set(ILifecycleService, lifecycle);
		services.set(ITelemetryService, NullTelemetryService);

		let inst = new InstantiationService(services);

		this.stacksModel = inst.createInstance(EditorStacksModel, true);
	}

	public fireChange(): void {
		this._onEditorsChanged.fire();
	}

	public get onEditorsChanged(): Event<void> {
		return this._onEditorsChanged.event;
	}

	public get onEditorOpening(): Event<IEditorOpeningEvent> {
		return this._onEditorOpening.event;
	}

	public get onEditorOpenFail(): Event<IEditorInput> {
		return this._onEditorOpenFail.event;
	}

	public get onEditorGroupMoved(): Event<void> {
		return this._onEditorsMoved.event;
	}

	public get onGroupOrientationChanged(): Event<void> {
		return this._onGroupOrientationChanged.event;
	}

	public get onTabOptionsChanged(): Event<IEditorTabOptions> {
		return this._onTabOptionsChanged.event;
	}

	public focusGroup(group: IEditorGroup): void;
	public focusGroup(position: Position): void;
	public focusGroup(arg1: any): void {

	}

	public activateGroup(group: IEditorGroup): void;
	public activateGroup(position: Position): void;
	public activateGroup(arg1: any): void {

	}

	public moveGroup(from: IEditorGroup, to: IEditorGroup): void;
	public moveGroup(from: Position, to: Position): void;
	public moveGroup(arg1: any, arg2: any): void {

	}

	public arrangeGroups(arrangement: GroupArrangement): void {

	}

	public setGroupOrientation(orientation: GroupOrientation): void {

	}

	public getGroupOrientation(): GroupOrientation {
		return 'vertical';
	}

	public resizeGroup(position: Position, groupSizeChange: number): void {

	}

	public pinEditor(group: IEditorGroup, input: IEditorInput): void;
	public pinEditor(position: Position, input: IEditorInput): void;
	public pinEditor(arg1: any, input: IEditorInput): void {
	}

	public unpinEditor(group: IEditorGroup, input: IEditorInput): void;
	public unpinEditor(position: Position, input: IEditorInput): void;
	public unpinEditor(arg1: any, input: IEditorInput): void {
	}

	public moveEditor(input: IEditorInput, from: IEditorGroup, to: IEditorGroup, moveOptions?: IMoveOptions): void;
	public moveEditor(input: IEditorInput, from: Position, to: Position, moveOptions?: IMoveOptions): void;
	public moveEditor(input: IEditorInput, from: any, to: any, moveOptions?: IMoveOptions): void {
	}

	public getStacksModel(): EditorStacksModel {
		return this.stacksModel;
	}

	public getTabOptions(): IEditorTabOptions {
		return {};
	}

	public invokeWithinEditorContext<T>(fn: (accessor: ServicesAccessor) => T): T {
		return fn(null);
	}
}

export class TestEditorService implements IWorkbenchEditorService {
	public _serviceBrand: any;

	public activeEditorInput: IEditorInput;
	public activeEditorOptions: IEditorOptions;
	public activeEditorPosition: Position;
	public mockLineNumber: number;

	private callback: (method: string) => void;

	constructor(callback?: (method: string) => void) {
		this.callback = callback || ((s: string) => { });
		this.mockLineNumber = 15;
	}

	public openEditors(inputs): Promise {
		return TPromise.as([]);
	}

	public replaceEditors(editors): TPromise<IEditor[]> {
		return TPromise.as([]);
	}

	public closeEditors(position: Position, filter?: { except?: IEditorInput, direction?: Direction, unmodifiedOnly?: boolean }): TPromise<void> {
		return TPromise.as(null);
	}

	public closeAllEditors(except?: Position): TPromise<void> {
		return TPromise.as(null);
	}

	public isVisible(input: IEditorInput, includeDiff: boolean): boolean {
		return false;
	}

	public getActiveEditor(): IEditor {
		this.callback('getActiveEditor');

		return {
			input: null,
			options: null,
			position: null,
			getId: () => { return null; },
			getControl: () => {
				return {
					getSelection: () => { return { positionLineNumber: this.mockLineNumber }; }
				};
			},
			focus: () => { },
			isVisible: () => { return true; }
		};
	}

	public getActiveEditorInput(): IEditorInput {
		this.callback('getActiveEditorInput');

		return this.activeEditorInput;
	}

	public getVisibleEditors(): IEditor[] {
		this.callback('getVisibleEditors');

		return [];
	}

	public openEditor(input: any, options?: any, position?: any): Promise {
		this.callback('openEditor');

		this.activeEditorInput = input;
		this.activeEditorOptions = options;
		this.activeEditorPosition = position;

		return TPromise.as(null);
	}

	public closeEditor(position: Position, input: IEditorInput): TPromise<void> {
		this.callback('closeEditor');

		return TPromise.as(null);
	}

	public createInput(input: IResourceInput): IEditorInput {
		return null;
	}
}

export class TestFileService implements IFileService {

	public _serviceBrand: any;

	private _onFileChanges: Emitter<FileChangesEvent>;
	private _onAfterOperation: Emitter<FileOperationEvent>;

	private content = 'Hello Html';

	constructor() {
		this._onFileChanges = new Emitter<FileChangesEvent>();
		this._onAfterOperation = new Emitter<FileOperationEvent>();
	}

	public setContent(content: string): void {
		this.content = content;
	}

	public getContent(): string {
		return this.content;
	}

	public get onFileChanges(): Event<FileChangesEvent> {
		return this._onFileChanges.event;
	}

	public fireFileChanges(event: FileChangesEvent): void {
		this._onFileChanges.fire(event);
	}

	public get onAfterOperation(): Event<FileOperationEvent> {
		return this._onAfterOperation.event;
	}

	public fireAfterOperation(event: FileOperationEvent): void {
		this._onAfterOperation.fire(event);
	}

	resolveFile(resource: URI, options?: IResolveFileOptions): TPromise<IFileStat> {
		return TPromise.as({
			resource,
			etag: Date.now().toString(),
			encoding: 'utf8',
			mtime: Date.now(),
			isDirectory: false,
			hasChildren: false,
			name: paths.basename(resource.fsPath)
		});
	}

	resolveFiles(toResolve: { resource: URI, options?: IResolveFileOptions }[]): TPromise<IResolveFileResult[]> {
		return TPromise.join(toResolve.map(resourceAndOption => this.resolveFile(resourceAndOption.resource, resourceAndOption.options))).then(stats => stats.map(stat => ({ stat, success: true })));
	}

	existsFile(resource: URI): TPromise<boolean> {
		return TPromise.as(null);
	}

	resolveContent(resource: URI, options?: IResolveContentOptions): TPromise<IContent> {
		return TPromise.as({
			resource: resource,
			value: this.content,
			etag: 'index.txt',
			encoding: 'utf8',
			mtime: Date.now(),
			name: paths.basename(resource.fsPath)
		});
	}

	resolveStreamContent(resource: URI, options?: IResolveContentOptions): TPromise<IStreamContent> {
		return TPromise.as({
			resource: resource,
			value: {
				on: (event: string, callback: Function): void => {
					if (event === 'data') {
						callback(this.content);
					}
					if (event === 'end') {
						callback();
					}
				}
			},
			etag: 'index.txt',
			encoding: 'utf8',
			mtime: Date.now(),
			name: paths.basename(resource.fsPath)
		});
	}

	updateContent(resource: URI, value: string, options?: IUpdateContentOptions): TPromise<IFileStat> {
		return TPromise.timeout(1).then(() => {
			return {
				resource,
				etag: 'index.txt',
				encoding: 'utf8',
				mtime: Date.now(),
				isDirectory: false,
				hasChildren: false,
				name: paths.basename(resource.fsPath)
			};
		});
	}

	moveFile(source: URI, target: URI, overwrite?: boolean): TPromise<IFileStat> {
		return TPromise.as(null);
	}

	copyFile(source: URI, target: URI, overwrite?: boolean): TPromise<IFileStat> {
		return TPromise.as(null);
	}

	createFile(resource: URI, content?: string, options?: ICreateFileOptions): TPromise<IFileStat> {
		return TPromise.as(null);
	}

	createFolder(resource: URI): TPromise<IFileStat> {
		return TPromise.as(null);
	}

	rename(resource: URI, newName: string): TPromise<IFileStat> {
		return TPromise.as(null);
	}

	touchFile(resource: URI): TPromise<IFileStat> {
		return TPromise.as(null);
	}

	del(resource: URI, useTrash?: boolean): TPromise<void> {
		return TPromise.as(null);
	}

	importFile(source: URI, targetFolder: URI): TPromise<IImportResult> {
		return TPromise.as(null);
	}

	watchFileChanges(resource: URI): void {
	}

	unwatchFileChanges(resource: URI): void {
	}

	updateOptions(options: any): void {
	}

	getEncoding(resource: URI): string {
		return 'utf8';
	}

	dispose(): void {
	}
}

export class TestBackupFileService implements IBackupFileService {
	public _serviceBrand: any;

	public backupEnabled: boolean;

	public hasBackups(): TPromise<boolean> {
		return TPromise.as(false);
	}

	public hasBackup(resource: URI): TPromise<boolean> {
		return TPromise.as(false);
	}

	public loadBackupResource(resource: URI): TPromise<URI> {
		return this.hasBackup(resource).then(hasBackup => {
			if (hasBackup) {
				return this.getBackupResource(resource);
			}

			return void 0;
		});
	}

	public registerResourceForBackup(resource: URI): TPromise<void> {
		return TPromise.as(void 0);
	}

	public deregisterResourceForBackup(resource: URI): TPromise<void> {
		return TPromise.as(void 0);
	}

	public getBackupResource(resource: URI): URI {
		return null;
	}

	public backupResource(resource: URI, content: string): TPromise<void> {
		return TPromise.as(void 0);
	}

	public getWorkspaceFileBackups(): TPromise<URI[]> {
		return TPromise.as([]);
	}

	public parseBackupContent(rawText: IRawTextSource): string {
		return rawText.lines.join('\n');
	}

	public discardResourceBackup(resource: URI): TPromise<void> {
		return TPromise.as(void 0);
	}

	public discardAllWorkspaceBackups(): TPromise<void> {
		return TPromise.as(void 0);
	}
};

export class TestWindowService implements IWindowService {

	public _serviceBrand: any;

	onDidChangeFocus: Event<boolean>;

	isFocused(): TPromise<boolean> {
		return TPromise.as(false);
	}

	getCurrentWindowId(): number {
		return 0;
	}

	pickFileFolderAndOpen(options: INativeOpenDialogOptions): TPromise<void> {
		return TPromise.as(void 0);
	}

	pickFileAndOpen(options: INativeOpenDialogOptions): TPromise<void> {
		return TPromise.as(void 0);
	}

	pickFolderAndOpen(options: INativeOpenDialogOptions): TPromise<void> {
		return TPromise.as(void 0);
	}

	pickWorkspaceAndOpen(options: INativeOpenDialogOptions): TPromise<void> {
		return TPromise.as(void 0);
	}

	reloadWindow(): TPromise<void> {
		return TPromise.as(void 0);
	}

	openDevTools(): TPromise<void> {
		return TPromise.as(void 0);
	}

	toggleDevTools(): TPromise<void> {
		return TPromise.as(void 0);
	}

	closeWorkspace(): TPromise<void> {
		return TPromise.as(void 0);
	}

	createAndEnterWorkspace(folders?: IWorkspaceFolderCreationData[], path?: string): TPromise<IEnterWorkspaceResult> {
		return TPromise.as(void 0);
	}

	saveAndEnterWorkspace(path: string): TPromise<IEnterWorkspaceResult> {
		return TPromise.as(void 0);
	}

	toggleFullScreen(): TPromise<void> {
		return TPromise.as(void 0);
	}

	setRepresentedFilename(fileName: string): TPromise<void> {
		return TPromise.as(void 0);
	}

	getRecentlyOpened(): TPromise<IRecentlyOpened> {
		return TPromise.as(void 0);
	}

	focusWindow(): TPromise<void> {
		return TPromise.as(void 0);
	}

	closeWindow(): TPromise<void> {
		return TPromise.as(void 0);
	}

	setDocumentEdited(flag: boolean): TPromise<void> {
		return TPromise.as(void 0);
	}

	isMaximized(): TPromise<boolean> {
		return TPromise.as(void 0);
	}

	maximizeWindow(): TPromise<void> {
		return TPromise.as(void 0);
	}

	unmaximizeWindow(): TPromise<void> {
		return TPromise.as(void 0);
	}

	onWindowTitleDoubleClick(): TPromise<void> {
		return TPromise.as(void 0);
	}

	show(): TPromise<void> {
		return TPromise.as(void 0);
	}

	showMessageBoxSync(options: Electron.MessageBoxOptions): number {
		return 0;
	}

	showMessageBox(options: Electron.MessageBoxOptions): Promise<IMessageBoxResult> {
		return TPromise.as(void 0);
	}

	showSaveDialog(options: Electron.SaveDialogOptions, callback?: (fileName: string) => void): string {
		return void 0;
	}

	showOpenDialog(options: Electron.OpenDialogOptions, callback?: (fileNames: string[]) => void): string[] {
		return void 0;
	}

	updateTouchBar(items: ICommandAction[][]): Promise<void> {
		return TPromise.as(void 0);
	}
}

export class TestLifecycleService implements ILifecycleService {

	public _serviceBrand: any;

	public phase: LifecyclePhase;
	public startupKind: StartupKind;

	private _onDidChangePhase = new Emitter<LifecyclePhase>();
	private _onWillShutdown = new Emitter<ShutdownEvent>();
	private _onShutdown = new Emitter<ShutdownReason>();


	public fireShutdown(reason = ShutdownReason.QUIT): void {
		this._onShutdown.fire(reason);
	}

	public fireWillShutdown(event: ShutdownEvent): void {
		this._onWillShutdown.fire(event);
	}

	public get onDidChangePhase(): Event<LifecyclePhase> {
		return this._onDidChangePhase.event;
	}

	public get onWillShutdown(): Event<ShutdownEvent> {
		return this._onWillShutdown.event;
	}

	public get onShutdown(): Event<ShutdownReason> {
		return this._onShutdown.event;
	}
}

export class TestWindowsService implements IWindowsService {

	_serviceBrand: any;

	public windowCount = 1;

	onWindowOpen: Event<number>;
	onWindowFocus: Event<number>;
	onWindowBlur: Event<number>;

	isFocused(windowId: number): TPromise<boolean> {
		return TPromise.as(false);
	}

	pickFileFolderAndOpen(options: INativeOpenDialogOptions): TPromise<void> {
		return TPromise.as(void 0);
	}

	pickFileAndOpen(options: INativeOpenDialogOptions): TPromise<void> {
		return TPromise.as(void 0);
	}

	pickFolderAndOpen(options: INativeOpenDialogOptions): TPromise<void> {
		return TPromise.as(void 0);
	}

	pickWorkspaceAndOpen(options: INativeOpenDialogOptions): TPromise<void> {
		return TPromise.as(void 0);
	}

	reloadWindow(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	openDevTools(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	toggleDevTools(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	closeWorkspace(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	createAndEnterWorkspace(windowId: number, folders?: IWorkspaceFolderCreationData[], path?: string): TPromise<IEnterWorkspaceResult> {
		return TPromise.as(void 0);
	}

	saveAndEnterWorkspace(windowId: number, path: string): TPromise<IEnterWorkspaceResult> {
		return TPromise.as(void 0);
	}

	toggleFullScreen(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	setRepresentedFilename(windowId: number, fileName: string): TPromise<void> {
		return TPromise.as(void 0);
	}

	addRecentlyOpened(files: string[]): TPromise<void> {
		return TPromise.as(void 0);
	}

	removeFromRecentlyOpened(paths: string[]): TPromise<void> {
		return TPromise.as(void 0);
	}

	clearRecentlyOpened(): TPromise<void> {
		return TPromise.as(void 0);
	}

	getRecentlyOpened(windowId: number): TPromise<IRecentlyOpened> {
		return TPromise.as(void 0);
	}

	focusWindow(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	closeWindow(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	isMaximized(windowId: number): TPromise<boolean> {
		return TPromise.as(void 0);
	}

	maximizeWindow(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	unmaximizeWindow(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	onWindowTitleDoubleClick(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	setDocumentEdited(windowId: number, flag: boolean): TPromise<void> {
		return TPromise.as(void 0);
	}

	quit(): TPromise<void> {
		return TPromise.as(void 0);
	}

	relaunch(options: { addArgs?: string[], removeArgs?: string[] }): TPromise<void> {
		return TPromise.as(void 0);
	}

	whenSharedProcessReady(): TPromise<void> {
		return TPromise.as(void 0);
	}

	toggleSharedProcess(): TPromise<void> {
		return TPromise.as(void 0);
	}

	// Global methods
	openWindow(paths: string[], options?: { forceNewWindow?: boolean, forceReuseWindow?: boolean, forceOpenWorkspaceAsFile?: boolean }): TPromise<void> {
		return TPromise.as(void 0);
	}

	openNewWindow(): TPromise<void> {
		return TPromise.as(void 0);
	}

	showWindow(windowId: number): TPromise<void> {
		return TPromise.as(void 0);
	}

	getWindows(): TPromise<{ id: number; workspace?: IWorkspaceIdentifier; folderPath?: string; title: string; filename?: string; }[]> {
		return TPromise.as(void 0);
	}

	getWindowCount(): TPromise<number> {
		return TPromise.as(this.windowCount);
	}

	log(severity: string, ...messages: string[]): TPromise<void> {
		return TPromise.as(void 0);
	}

	showItemInFolder(path: string): TPromise<void> {
		return TPromise.as(void 0);
	}

	showPreviousWindowTab(): Promise<void> {
		return TPromise.as(void 0);
	}

	showNextWindowTab(): Promise<void> {
		return TPromise.as(void 0);
	}

	moveWindowTabToNewWindow(): Promise<void> {
		return TPromise.as(void 0);
	}

	mergeAllWindowTabs(): Promise<void> {
		return TPromise.as(void 0);
	}

	toggleWindowTabsBar(): Promise<void> {
		return TPromise.as(void 0);
	}

	updateTouchBar(windowId: number, items: ICommandAction[][]): Promise<void> {
		return TPromise.as(void 0);
	}

	// This needs to be handled from browser process to prevent
	// foreground ordering issues on Windows
	openExternal(url: string): TPromise<boolean> {
		return TPromise.as(true);
	}

	// TODO: this is a bit backwards
	startCrashReporter(config: Electron.CrashReporterStartOptions): TPromise<void> {
		return TPromise.as(void 0);
	}
}

export class TestTextResourceConfigurationService implements ITextResourceConfigurationService {

	_serviceBrand: any;

	constructor(private configurationService = new TestConfigurationService()) {
	}

	public onDidChangeConfiguration() {
		return { dispose() { } };
	}

	public getConfiguration(resource: URI, section?: string): any;
	public getConfiguration(resource: URI, position?: IPosition, section?: string): any;
	public getConfiguration(resource: any, position?: any, section?: any): any;
	public getConfiguration(resource: any, position?: any, section?: any): any {
		return this.configurationService.getConfiguration(section, { resource });
	}
}

export class TestHashService implements IHashService {
	_serviceBrand: any;

	createSHA1(content: string): string {
		return content;
	}
}

export function getRandomTestPath(tmpdir: string, ...segments: string[]): string {
	return paths.join(tmpdir, ...segments, generateUuid());
}