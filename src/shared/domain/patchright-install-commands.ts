export const PATCHRIGHT_VERSION = '1.63.0';

const PATCHRIGHT_PACKAGE = `patchright@${PATCHRIGHT_VERSION}`;
const PATCHRIGHT_EXEC = `npm exec -y -p ${PATCHRIGHT_PACKAGE} -- patchright`;

export const MANUAL_INSTALL_COMMAND = `${PATCHRIGHT_EXEC} install chromium`;
export const LINUX_DEPS_COMMAND = `sudo ${PATCHRIGHT_EXEC} install-deps chromium`;
export const LINUX_INSTALL_WITH_DEPS_COMMAND = `${PATCHRIGHT_EXEC} install --with-deps chromium`;
