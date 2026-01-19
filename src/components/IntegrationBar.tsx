import { useState } from "react";
import { GitHubState, VercelState, ClaudeState } from "../App";

interface IntegrationBarProps {
  githubState: GitHubState;
  vercelState: VercelState;
  claudeState: ClaudeState;
  onGitHubConnect: () => void;
  onVercelConnect: () => void;
  onClaudeConnect: () => void;
  isInstallingClaude?: boolean;
  isInstallingVercel?: boolean;
}

export function IntegrationBar({
  githubState,
  vercelState,
  claudeState,
  onGitHubConnect,
  onVercelConnect,
  onClaudeConnect,
  isInstallingClaude = false,
  isInstallingVercel = false,
}: IntegrationBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const claudeConnected = claudeState.cliStatus.installed;
  const githubConnected = githubState.cliStatus.authenticated;
  const vercelConnected = vercelState.cliStatus.authenticated;

  const allConnected = claudeConnected && githubConnected && vercelConnected;
  const connectedCount = [claudeConnected, githubConnected, vercelConnected].filter(Boolean).length;

  return (
    <div className={`integration-bar ${isExpanded ? "expanded" : ""}`}>
      <button
        className="integration-bar-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {allConnected ? (
          <>
            <CheckIcon className="integration-bar-icon success" />
            <span>All integrations connected</span>
          </>
        ) : (
          <>
            <WarningIcon className="integration-bar-icon warning" />
            <span>{connectedCount}/3 integrations connected</span>
          </>
        )}
        <ChevronIcon className={`integration-bar-chevron ${isExpanded ? "up" : "down"}`} />
      </button>

      {isExpanded && (
        <div className="integration-bar-content">
          {/* Claude */}
          <div className={`integration-bar-item ${claudeConnected ? "connected" : ""}`}>
            <div className="integration-bar-item-icon">
              <ClaudeIcon />
            </div>
            <div className="integration-bar-item-info">
              <span className="integration-bar-item-name">Claude</span>
              {claudeConnected ? (
                <span className="integration-bar-item-status success">
                  {claudeState.cliStatus.version || "Connected"}
                </span>
              ) : (
                <span className="integration-bar-item-status">Not installed</span>
              )}
            </div>
            {!claudeConnected && (
              <button
                className="integration-bar-item-action"
                onClick={onClaudeConnect}
                disabled={isInstallingClaude}
              >
                {isInstallingClaude ? "Installing..." : "Install"}
              </button>
            )}
          </div>

          {/* GitHub */}
          <div className={`integration-bar-item ${githubConnected ? "connected" : ""}`}>
            <div className="integration-bar-item-icon">
              <GitHubIcon />
            </div>
            <div className="integration-bar-item-info">
              <span className="integration-bar-item-name">GitHub</span>
              {!githubState.cliStatus.installed ? (
                <span className="integration-bar-item-status">CLI not installed</span>
              ) : !githubState.cliStatus.authenticated ? (
                <span className="integration-bar-item-status">Not connected</span>
              ) : (
                <span className="integration-bar-item-status success">
                  {githubState.username}
                </span>
              )}
            </div>
            {!githubState.cliStatus.installed ? (
              <a
                href="https://cli.github.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="integration-bar-item-action"
              >
                Install
              </a>
            ) : !githubState.cliStatus.authenticated ? (
              <button
                className="integration-bar-item-action"
                onClick={onGitHubConnect}
              >
                Connect
              </button>
            ) : null}
          </div>

          {/* Vercel */}
          <div className={`integration-bar-item ${vercelConnected ? "connected" : ""}`}>
            <div className="integration-bar-item-icon">
              <VercelIcon />
            </div>
            <div className="integration-bar-item-info">
              <span className="integration-bar-item-name">Vercel</span>
              {!vercelState.cliStatus.installed ? (
                <span className="integration-bar-item-status">CLI not installed</span>
              ) : !vercelState.cliStatus.authenticated ? (
                <span className="integration-bar-item-status">Not connected</span>
              ) : (
                <span className="integration-bar-item-status success">
                  {vercelState.username || "Connected"}
                </span>
              )}
            </div>
            {!vercelState.cliStatus.installed ? (
              <button
                className="integration-bar-item-action"
                onClick={onVercelConnect}
                disabled={isInstallingVercel}
              >
                {isInstallingVercel ? "Installing..." : "Install"}
              </button>
            ) : !vercelState.cliStatus.authenticated ? (
              <button
                className="integration-bar-item-action"
                onClick={onVercelConnect}
              >
                Connect
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ClaudeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 1200 1200" fill="currentColor">
      <path d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function VercelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 116 100" fill="currentColor">
      <path d="M57.5 0L115 100H0L57.5 0Z" />
    </svg>
  );
}
