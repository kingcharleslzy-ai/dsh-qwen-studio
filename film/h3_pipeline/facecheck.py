from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Protocol

from PIL import Image, ImageStat


# Pluggable face-consistency warning. Backends compare a reference person image
# with sampled frames of the accepted clip and report observations; aggregation
# can only WARN — an automatic score never approves identity. Backends must be
# local and license-clear: no silent model downloads, no photo uploads, no paid
# cloud calls. When no compliant model is configured, the unavailable backend
# reports clear install instructions instead of faking detections.

INSTALL_HINT = (
    "未配置合规的人脸一致性后端。配置方法："
    "1) 自行获取许可证明确的本地人脸模型并记录来源。InsightFace代码是MIT，但其官方buffalo系列预训练模型"
    "默认仅限非商业研究，商业使用需要另行取得模型授权；"
    "2) 模型目录必须采用 <root>/models/<模型包名> 并已包含ONNX文件；"
    "3) 在 工程/video_project.yaml 增加 qa.face_consistency: "
    "{backend: insightface, model_path: <模型包目录>, model_source: <来源>, license_scope: noncommercial-research}；"
    "4) 重新运行 svd h3 qa。"
    "禁止自动下载许可证不明的模型、上传用户照片、调用未批准的付费云服务；未配置期间人物身份由当前Agent视觉审片"
)

DEFAULT_SIMILARITY_WARN_BELOW = 0.55
DEFAULT_FRAMES_PER_SHOT = 5
LOW_CONFIDENCE = 0.5


@dataclass
class FaceObservation:
    frame: str
    face_found: bool
    similarity: float | None
    pose: str = "unknown"
    occluded: bool | None = None
    confidence: float = 0.0


@dataclass
class BackendStatus:
    available: bool
    backend: str
    detail: str


class FaceBackend(Protocol):
    name: str

    def status(self) -> BackendStatus: ...

    def observe(self, reference: Path, frame: Path) -> FaceObservation: ...


class UnavailableFaceBackend:
    name = "unavailable"

    def __init__(self, reason: str = ""):
        self.reason = reason

    def status(self) -> BackendStatus:
        detail = self.reason or INSTALL_HINT
        return BackendStatus(False, self.name, detail)

    def observe(self, reference: Path, frame: Path) -> FaceObservation:
        raise RuntimeError("人脸一致性后端不可用，不能伪造检测结果")


class StubFaceBackend:
    """Deterministic pixel-similarity double for tests/CI. NOT a real face detector."""

    name = "stub"

    def status(self) -> BackendStatus:
        return BackendStatus(True, self.name, "stub后端（测试专用，输出为整图像素伪相似度，非真实人脸检测）")

    def _embedding(self, path: Path) -> list[float]:
        image = Image.open(path).convert("L").resize((16, 16), Image.Resampling.BILINEAR)
        flattened = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
        values = [value / 255.0 for value in flattened]
        mean = sum(values) / len(values)
        centered = [value - mean for value in values]
        return centered if any(centered) else values

    def observe(self, reference: Path, frame: Path) -> FaceObservation:
        image = Image.open(frame).convert("L")
        brightness = ImageStat.Stat(image).mean[0]
        if brightness < 8.0:
            return FaceObservation(frame=frame.name, face_found=False, similarity=None, confidence=0.0)
        left, right = self._embedding(reference), self._embedding(frame)
        dot = sum(a * b for a, b in zip(left, right))
        norm = math.sqrt(sum(a * a for a in left)) * math.sqrt(sum(b * b for b in right))
        similarity = dot / norm if norm else 0.0
        return FaceObservation(frame=frame.name, face_found=True, similarity=round(similarity, 4), pose="frontal", occluded=False, confidence=0.99)


class InsightfaceBackend:
    """Local InsightFace adapter. Never downloads: the model dir must already exist."""

    name = "insightface"

    def __init__(self, model_path: Path, *, model_source: str = "", license_scope: str = ""):
        self.model_path = model_path.expanduser()
        self.model_source = model_source.strip()
        self.license_scope = license_scope.strip()
        self._app = None
        self._reference_embedding: dict[Path, Any] = {}

    def status(self) -> BackendStatus:
        if self.license_scope not in {"noncommercial-research", "commercial-licensed"}:
            return BackendStatus(False, self.name, "未明确模型许可范围；license_scope必须是noncommercial-research或commercial-licensed。" + INSTALL_HINT)
        if not self.model_source:
            return BackendStatus(False, self.name, "未记录模型来源model_source，无法审计许可证。" + INSTALL_HINT)
        if not self.model_path.is_dir():
            return BackendStatus(False, self.name, f"模型目录不存在：{self.model_path}。不会自动下载；" + INSTALL_HINT)
        if self.model_path.parent.name.lower() != "models":
            return BackendStatus(False, self.name, "模型目录必须是 <root>/models/<模型包名>，否则InsightFace可能尝试联网下载；已拒绝加载。" + INSTALL_HINT)
        onnx_files = sorted(self.model_path.glob("*.onnx"))
        if len(onnx_files) < 2:
            return BackendStatus(False, self.name, "模型包缺少完整ONNX文件，已拒绝加载以防自动下载。" + INSTALL_HINT)
        try:
            import insightface  # noqa: F401
        except ImportError:
            return BackendStatus(False, self.name, "insightface 未安装。" + INSTALL_HINT)
        return BackendStatus(
            True,
            self.name,
            f"insightface 本地模型：{self.model_path}；许可范围={self.license_scope}；来源={self.model_source}",
        )

    def _load(self) -> None:
        if self._app is not None:
            return
        from insightface.app import FaceAnalysis

        status = self.status()
        if not status.available:
            raise RuntimeError(status.detail)
        # FaceAnalysis expects <root>/models/<name>. Requiring that exact layout
        # before construction prevents its built-in downloader from being used.
        app = FaceAnalysis(name=self.model_path.name, root=str(self.model_path.parent.parent), providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=-1, det_size=(640, 640))
        self._app = app

    def _embedding(self, path: Path) -> tuple[Any, list[Any]]:
        import cv2

        self._load()
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError(f"无法读取人脸图像：{path}")
        faces = self._app.get(image)
        if not faces:
            return None, []
        primary = max(faces, key=lambda face: float(getattr(face, "det_score", 0)))
        return getattr(primary, "normed_embedding", None), faces

    def observe(self, reference: Path, frame: Path) -> FaceObservation:
        import numpy as np

        if reference not in self._reference_embedding:
            embedding, _ = self._embedding(reference)
            self._reference_embedding[reference] = embedding
        reference_embedding = self._reference_embedding[reference]
        embedding, faces = self._embedding(frame)
        if not faces:
            return FaceObservation(frame=frame.name, face_found=False, similarity=None, confidence=0.0)
        primary = max(faces, key=lambda face: float(getattr(face, "det_score", 0)))
        confidence = float(getattr(primary, "det_score", 0.0))
        similarity = None
        if reference_embedding is not None and embedding is not None:
            similarity = round(float(np.dot(reference_embedding, embedding)), 4)
        pose = "frontal"
        angles = getattr(primary, "pose", None)
        if angles is not None and abs(float(angles[1])) > 35.0:
            pose = "profile"
        # The standard InsightFace pack used here does not provide a reliable
        # glasses/occlusion verdict. Keep it unknown instead of claiming false.
        return FaceObservation(frame=frame.name, face_found=True, similarity=similarity, pose=pose, occluded=None, confidence=confidence)


def face_config(project: Any) -> dict[str, Any]:
    return dict((project.data.get("qa") or {}).get("face_consistency") or {})


def resolve_backend(project: Any, *, allow_test_backend: bool = False) -> FaceBackend:
    """Resolve the configured backend; network/paid backends are refused outright."""
    config = face_config(project)
    name = str(config.get("backend") or "").strip()
    if not name:
        return UnavailableFaceBackend()
    lowered = name.lower()
    if lowered.startswith(("http", "cloud", "api", "online")):
        return UnavailableFaceBackend(f"拒绝配置的人脸后端“{name}”：不允许上传照片或调用在线/付费服务。" + INSTALL_HINT)
    if lowered == "stub":
        if allow_test_backend:
            return StubFaceBackend()
        return UnavailableFaceBackend("拒绝stub后端：它只用于单元测试，生产QA不得产生伪相似度。" + INSTALL_HINT)
    if lowered == "insightface":
        model_path = config.get("model_path")
        if not model_path:
            return UnavailableFaceBackend("qa.face_consistency.model_path 未配置。" + INSTALL_HINT)
        return InsightfaceBackend(
            Path(str(model_path)),
            model_source=str(config.get("model_source") or ""),
            license_scope=str(config.get("license_scope") or ""),
        )
    return UnavailableFaceBackend(f"未知人脸后端“{name}”。" + INSTALL_HINT)


def identity_reference_for(project: Any, shot: dict[str, Any]) -> Path | None:
    """The reference person image for identity-critical shots."""
    explicit = project.path_for(shot.get("identity_reference"))
    if explicit:
        return explicit
    if shot.get("identity_critical") or str(shot.get("workflow")) == "reference":
        for value in shot.get("reference_images") or []:
            path = project.path_for(str(value))
            if path:
                return path
        return project.path_for(shot.get("start_image"))
    return None


def aggregate_observations(observations: list[FaceObservation], threshold: float) -> tuple[str, str, dict[str, Any]]:
    """WARN-only aggregation; an automatic score never approves identity."""
    total = len(observations)
    no_face = sum(not item.face_found for item in observations)
    profile = sum(item.pose == "profile" for item in observations if item.face_found)
    occluded = sum(item.occluded is True for item in observations if item.face_found)
    occlusion_unknown = sum(item.occluded is None for item in observations if item.face_found)
    low_confidence = sum(item.confidence < LOW_CONFIDENCE for item in observations if item.face_found)
    usable = [
        item.similarity
        for item in observations
        if item.face_found and item.pose != "profile" and item.occluded is not True and item.confidence >= LOW_CONFIDENCE and item.similarity is not None
    ]
    median_similarity = None
    if usable:
        ordered = sorted(usable)
        middle = len(ordered) // 2
        median_similarity = ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2
    problems: list[str] = []
    if total and no_face == total:
        problems.append("所有抽帧均未检测到人脸")
    elif no_face:
        problems.append(f"{no_face}/{total} 帧无脸")
    if median_similarity is None:
        problems.append("没有可用正脸帧，无法计算相似度")
    elif median_similarity < threshold:
        problems.append(f"中位相似度 {median_similarity:.3f} 低于阈值 {threshold:.2f}")
    if profile:
        problems.append(f"{profile} 帧侧脸")
    if occluded:
        problems.append(f"{occluded} 帧疑似眼镜/遮挡")
    if occlusion_unknown:
        problems.append(f"{occlusion_unknown} 帧未提供遮挡判定")
    if low_confidence:
        problems.append(f"{low_confidence} 帧低置信度")
    stats = {
        "frames": total,
        "no_face": no_face,
        "profile": profile,
        "occluded": occluded,
        "occlusion_unknown": occlusion_unknown,
        "low_confidence": low_confidence,
        "usable_frontal": len(usable),
        "median_similarity": median_similarity,
        "threshold": threshold,
    }
    summary = "；".join(problems) if problems else f"中位相似度 {median_similarity:.3f}，未发现预警项"
    detail = f"{summary}；自动分数仅作预警/待审依据，人物身份必须由当前Agent视觉核对确认"
    return ("WARN" if problems else "OK"), detail, stats


def observations_as_dicts(observations: list[FaceObservation]) -> list[dict[str, Any]]:
    return [asdict(item) for item in observations]
