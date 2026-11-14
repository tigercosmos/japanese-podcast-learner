"""Errors whose message is shown to the user."""


class PipelineError(Exception):
    """A failure with a Traditional Chinese message for the UI.

    ``code`` lets the UI offer a way out of one specific failure.
    """

    code = "error"


class NotEmbeddableError(PipelineError):
    """The player on another site refuses the video."""

    code = "not_embeddable"

# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:
