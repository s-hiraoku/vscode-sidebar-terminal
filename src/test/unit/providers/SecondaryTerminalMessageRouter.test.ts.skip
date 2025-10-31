import { expect } from 'chai';
import * as sinon from 'sinon';

import '../../shared/TestSetup';
import { SecondaryTerminalMessageRouter } from '../../../providers/SecondaryTerminalMessageRouter';
import { WebviewMessage } from '../../../types/common';

describe('SecondaryTerminalMessageRouter', () => {
  it('registers command maps and dispatches handlers', async () => {
    const router = new SecondaryTerminalMessageRouter();
    const handler = sinon.stub().resolves();

    router.registerAll({ createTerminal: handler });

    const dispatched = await router.dispatch({ command: 'createTerminal' } as WebviewMessage);

    expect(dispatched).to.be.true;
    expect(handler.calledOnce).to.be.true;
  });
});
