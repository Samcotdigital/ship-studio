import { useState, useCallback } from 'react';

interface UseWorkspaceModalsParams {
  focusActiveTerminal: () => void;
}

export function useWorkspaceModals({ focusActiveTerminal }: UseWorkspaceModalsParams) {
  const [showEnvEditor, setShowEnvEditor] = useState(false);
  const [showBackupsModal, setShowBackupsModal] = useState(false);
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);
  const [isEducationMode, setIsEducationMode] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [showPluginManager, setShowPluginManager] = useState(false);
  const [showDevCommandModal, setShowDevCommandModal] = useState(false);

  // Open handlers
  const openEnvEditor = useCallback(() => setShowEnvEditor(true), []);
  const openBackupsModal = useCallback(() => setShowBackupsModal(true), []);
  const openAssetsPanel = useCallback(() => setShowAssetsPanel(true), []);
  const openHelpModal = useCallback(() => setShowHelpModal(true), []);
  const openSkillsModal = useCallback(() => setShowSkillsModal(true), []);
  const openMcpModal = useCallback(() => setShowMcpModal(true), []);
  const openPluginManager = useCallback(() => setShowPluginManager(true), []);
  const openDevCommandModal = useCallback(() => setShowDevCommandModal(true), []);

  // Close handlers — some refocus the terminal, matching existing App.tsx behavior
  const closeEnvEditor = useCallback(() => {
    setShowEnvEditor(false);
    focusActiveTerminal();
  }, [focusActiveTerminal]);

  const closeBackupsModal = useCallback(() => {
    setShowBackupsModal(false);
    focusActiveTerminal();
  }, [focusActiveTerminal]);

  const closeAssetsPanel = useCallback(() => {
    setShowAssetsPanel(false);
    focusActiveTerminal();
  }, [focusActiveTerminal]);

  const closeEducation = useCallback(() => setIsEducationMode(false), []);
  const closeHelpModal = useCallback(() => setShowHelpModal(false), []);
  const closeSkillsModal = useCallback(() => setShowSkillsModal(false), []);
  const closeMcpModal = useCallback(() => setShowMcpModal(false), []);
  const closePluginManager = useCallback(() => setShowPluginManager(false), []);
  const closeDevCommandModal = useCallback(() => {
    setShowDevCommandModal(false);
    focusActiveTerminal();
  }, [focusActiveTerminal]);

  return {
    showEnvEditor,
    openEnvEditor,
    closeEnvEditor,
    showBackupsModal,
    openBackupsModal,
    closeBackupsModal,
    showAssetsPanel,
    openAssetsPanel,
    closeAssetsPanel,
    isEducationMode,
    setIsEducationMode,
    closeEducation,
    showHelpModal,
    openHelpModal,
    closeHelpModal,
    showSkillsModal,
    openSkillsModal,
    closeSkillsModal,
    showMcpModal,
    openMcpModal,
    closeMcpModal,
    showPluginManager,
    openPluginManager,
    closePluginManager,
    showDevCommandModal,
    openDevCommandModal,
    closeDevCommandModal,
  };
}
