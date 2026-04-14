allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Redirection du build vers un chemin sans espaces (C:/flutter_build)
rootProject.layout.buildDirectory.set(file("C:/flutter_build/medica_sign"))

subprojects {
    project.layout.buildDirectory.set(rootProject.layout.buildDirectory.dir(project.name))
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(layout.buildDirectory)
}
