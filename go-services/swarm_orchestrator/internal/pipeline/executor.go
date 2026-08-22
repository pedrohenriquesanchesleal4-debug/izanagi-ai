package pipeline

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/domain"
)

// FileArtifactExecutor is the default StageExecutor: it renders a rich
// markdown artifact for the stage and persists it under
// <Root>/<taskId>/NN-<role>.md, creating directories as needed. It performs
// no external calls — it is real pipeline machinery whose outputs feed the
// next stage's context.
type FileArtifactExecutor struct {
	Root string
}

var _ domain.StageExecutor = (*FileArtifactExecutor)(nil)

// NewFileArtifactExecutor builds an executor rooted at dir.
func NewFileArtifactExecutor(dir string) *FileArtifactExecutor {
	return &FileArtifactExecutor{Root: dir}
}

// Execute renders and writes one stage artifact.
func (e *FileArtifactExecutor) Execute(ctx context.Context, in domain.StageInput) (domain.StageOutput, error) {
	if err := ctx.Err(); err != nil {
		return domain.StageOutput{}, fmt.Errorf("stage %s canceled before start: %w", in.Role, err)
	}

	dir := filepath.Join(e.Root, in.TaskID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return domain.StageOutput{}, fmt.Errorf("create artifact dir %s: %w", dir, err)
	}

	content := renderStage(in)
	path := filepath.Join(dir, fmt.Sprintf("%02d-%s.md", in.Index+1, in.Role))

	if err := writeAtomic(ctx, path, []byte(content)); err != nil {
		return domain.StageOutput{}, fmt.Errorf("write artifact %s: %w", path, err)
	}

	return domain.StageOutput{
		Role:         in.Role,
		Index:        in.Index,
		Content:      content,
		ArtifactPath: path,
	}, nil
}

// writeAtomic writes via temp file + rename so readers never observe
// half-written artifacts, honoring cancellation between steps.
func writeAtomic(ctx context.Context, path string, data []byte) error {
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("canceled before write: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("rename into place: %w", err)
	}
	return nil
}

// stageBrief describes what each canonical role delivers. Custom roles fall
// back to the generic brief.
func stageBrief(role string) string {
	switch role {
	case domain.RoleArchitect:
		return "Arquitetura proposta, decisões registradas (ADRs), componentes e fronteiras, riscos técnicos."
	case domain.RoleSeniorEngineer:
		return "Plano de implementação, módulos tocados, contratos de código e critérios de aceite técnicos."
	case domain.RoleQA:
		return "Estratégia de testes (pirâmide), casos por requisito, matriz de riscos e critérios de regressão."
	case domain.RoleSecurity:
		return "Threat model, checklist OWASP aplicado ao escopo e recomendações de hardening."
	default:
		return "Plano de execução do papel, entregáveis esperados e critérios de conclusão da fase."
	}
}

// stageDeliverable renders deterministic body content per role so every
// artifact is a complete document even without any LLM in the loop.
func stageDeliverable(in domain.StageInput) string {
	var b strings.Builder
	fmt.Fprintf(&b, "## Entregável da fase (%s)\n\n", in.Role)
	fmt.Fprintf(&b, "- Escopo recebido: %q\n", summarize(in.Prompt, 220))
	switch in.Role {
	case domain.RoleArchitect:
		b.WriteString("- Decisões: manter arquitetura em camadas com contratos explícitos entre estágios.\n")
		b.WriteString("- Componentes impactados e dependências listados para o estágio de implementação.\n")
	default:
		b.WriteString("- Diretriz: consumir o contexto dos estágios anteriores antes de produzir o entregável final.\n")
	}
	fmt.Fprintf(&b, "- Critério de conclusão: %s\n", stageBrief(in.Role))
	fmt.Fprintf(&b, "- Gerado em: %s (maquinaria de pipeline, sem inferência externa)\n",
		time.Now().UTC().Format(time.RFC3339))
	return b.String()
}

// renderStage composes the full markdown artifact for a stage.
func renderStage(in domain.StageInput) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# Artefato %02d/%02d — %s\n\n", in.Index+1, in.TotalStages, in.Role)
	fmt.Fprintf(&b, "| Campo | Valor |\n|---|---|\n")
	fmt.Fprintf(&b, "| TaskID | `%s` |\n", in.TaskID)
	fmt.Fprintf(&b, "| Papel | `%s` |\n", in.Role)
	fmt.Fprintf(&b, "| Estágio | %d de %d |\n", in.Index+1, in.TotalStages)

	b.WriteString("\n## Prompt original\n\n")
	fmt.Fprintf(&b, "> %s\n", strings.ReplaceAll(strings.TrimSpace(in.Prompt), "\n", "\n> "))

	if len(in.Previous) > 0 {
		b.WriteString("\n## Contexto herdado dos estágios anteriores\n")
		for _, prev := range in.Previous {
			fmt.Fprintf(&b, "\n### Saída %02d — %s\n\n%s\n",
				prev.Index+1, prev.Role, indentBlock(summarize(prev.Content, 400)))
		}
	} else {
		b.WriteString("\n## Contexto herdado dos estágios anteriores\n\nNenhum — este é o primeiro estágio da cadeia.\n")
	}

	b.WriteString("\n")
	b.WriteString(stageDeliverable(in))
	return b.String()
}

// summarize trims s to at most max runes on word boundaries.
func summarize(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	cut := s[:max]
	if i := strings.LastIndexByte(cut, ' '); i > 0 {
		cut = cut[:i]
	}
	return cut + "…"
}

func indentBlock(s string) string {
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = "> " + l
	}
	return strings.Join(lines, "\n")
}
