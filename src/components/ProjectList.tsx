import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Project {
  name: string;
  path: string;
  thumbnail: string | null;
}

interface ProjectWithThumbnail extends Project {
  thumbnailData: string | null;
}

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
}

export function ProjectList({ onSelectProject, onCreateProject }: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectWithThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProjects = async () => {
    try {
      const projectList = await invoke<Project[]>("list_projects");

      // Load thumbnails for each project
      const projectsWithThumbnails = await Promise.all(
        projectList.map(async (project) => {
          let thumbnailData: string | null = null;
          if (project.thumbnail) {
            try {
              thumbnailData = await invoke<string | null>("get_project_thumbnail", {
                projectPath: project.path,
              });
            } catch (e) {
              console.error("Failed to load thumbnail for", project.name, e);
            }
          }
          return { ...project, thumbnailData };
        })
      );

      setProjects(projectsWithThumbnails);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (project: Project) => {
    setDeleting(true);
    try {
      await invoke("delete_project", { path: project.path });
      setDeleteConfirm(null);
      await loadProjects();
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("Failed to delete project: " + error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="project-list-loading">
        <div className="spinner" />
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="project-list">
      <div className="project-list-header">
        <h1>MarOS</h1>
        <p>Build AI native marketing sites easily with SOTA technology.</p>
      </div>

      <div className="project-list-actions">
        <button className="btn-primary" onClick={onCreateProject}>
          + New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="project-list-empty">
          <p>No projects yet</p>
          <p className="hint">Create your first project to get started</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <div key={project.path} className="project-card">
              <button
                className="project-card-thumbnail"
                onClick={() => onSelectProject(project)}
              >
                {project.thumbnailData ? (
                  <img
                    src={project.thumbnailData}
                    alt={project.name}
                  />
                ) : (
                  <div className="project-card-placeholder">
                    <span>No preview</span>
                  </div>
                )}
              </button>
              <div className="project-card-info">
                <div className="project-card-details">
                  <span className="project-card-name">{project.name}</span>
                  <span className="project-card-path">{project.path}</span>
                </div>
                <button
                  className="project-card-menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(project);
                  }}
                  title="Delete project"
                >
                  •••
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Project?</h3>
            <p>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <p className="hint">This will permanently delete all files in this project.</p>
            <div className="modal-actions">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
